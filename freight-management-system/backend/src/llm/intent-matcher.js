const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const axios = require('axios');
const logger = require('../utils/logger');
const intentDefinitions = require('./tara-intents');

const DEFAULT_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
// For Google, we'll use text-embedding-004 by default
const GOOGLE_EMBEDDING_MODEL = 'text-embedding-004';
const DEFAULT_THRESHOLD = Number.parseFloat(process.env.TARA_INTENT_THRESHOLD || '0.6');
const DEFAULT_AI_TIMEOUT = Number.parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '5000', 10);

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return -1;
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const valA = a[i];
    const valB = b[i];
    dot += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) return -1;
  return dot / denominator;
};

class IntentMatcher {
  constructor() {
    this.enabled = false;
    if (process.env.ENABLE_EXTERNAL_AI !== 'true') {
      logger.info('IntentMatcher disabled: ENABLE_EXTERNAL_AI flag is not true.');
      return;
    }

    this.serviceUrl = process.env.AI_SERVICE_URL;
    this.serviceTimeout = DEFAULT_AI_TIMEOUT;

    if (this.serviceUrl && this.serviceUrl !== 'http://localhost:9000') {
      // Logic to ignore placeholder service URL if needed, but keeping existing behavior
      // assuming explicit configuration means "use service".
      // However, if we want to force internal use when Google Key is present, we check that first.
    }

    // Check for Google Key first as primary replacement
    const googleKey = process.env.GOOGLE_API_KEY;
    if (googleKey) {
      this.enabled = true;
      this.provider = 'google';
      this.genAI = new GoogleGenerativeAI(googleKey);
      this.model = this.genAI.getGenerativeModel({ model: GOOGLE_EMBEDDING_MODEL });
      logger.info('IntentMatcher initialized with Google Generative AI.');
    } else {
      // Fallback to OpenAI
      const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
      if (apiKey) {
        this.enabled = true;
        this.provider = 'openai';
        this.model = DEFAULT_MODEL;
        this.openai = new OpenAI({ apiKey });
        logger.info('IntentMatcher initialized with OpenAI.');
      } else if (this.serviceUrl) {
        this.enabled = true;
        this.provider = 'service';
        this.http = axios.create({
          baseURL: this.serviceUrl.replace(/\/$/, ''),
          timeout: this.serviceTimeout,
        });
        if (process.env.AI_SERVICE_API_KEY) {
          this.http.defaults.headers.common['x-ai-key'] = process.env.AI_SERVICE_API_KEY;
        }
        logger.info(`IntentMatcher using external AI service at ${this.serviceUrl}`);
      } else {
        logger.warn('IntentMatcher disabled: No API key (Google/OpenAI) or AI Service configured.');
        this.enabled = false;
      }
    }

    if (this.enabled) {
      this.threshold = DEFAULT_THRESHOLD;
      this.intentStore = intentDefinitions.map((intent) => ({
        action: intent.action,
        examples: intent.examples,
        embeddings: [],
      }));
      this.initialised = false;
    }
  }

  mapRemoteIntent(intent) {
    if (!intent) return null;
    const normalized = intent.toLowerCase();
    switch (normalized) {
      case 'shipment_update':
      case 'update_shipment':
        return 'update_shipment';
      case 'shipment_overview':
      case 'shipments':
      case 'get_shipments':
        return 'get_shipments';
      case 'quotes':
      case 'get_quotes':
        return 'get_quotes';
      case 'assignments':
      case 'transporter':
      case 'get_assignments':
        return 'get_assignments';
      case 'help':
      case 'general_inquiry':
        return 'help';
      default:
        return intent;
    }
  }

  async matchViaService(message) {
    try {
      const response = await this.http.post('/analyze-intent', { text: message });
      const intent = this.mapRemoteIntent(response.data?.intent);
      if (!intent) {
        return null;
      }
      return {
        action: intent,
        score: Number.parseFloat(response.data?.confidence ?? '0.5'),
        source: 'ai-service',
      };
    } catch (error) {
      logger.error('IntentMatcher AI service call failed', {
        error: error.message,
        serviceUrl: this.serviceUrl,
      });
      return null;
    }
  }

  async ensureEmbeddings() {
    if (!this.enabled || this.initialised || this.provider === 'service') {
      return;
    }

    try {
      const inputs = [];
      const meta = [];
      this.intentStore.forEach((intent, intentIndex) => {
        intent.examples.forEach((example, exampleIndex) => {
          inputs.push(example);
          meta.push({ intentIndex, exampleIndex });
        });
      });

      if (!inputs.length) {
        this.initialised = true;
        return;
      }

      if (this.provider === 'google') {
        // Google embeddings need individual calls or batching depending on API, 
        // but embedContent usually takes one string. 
        // We'll iterate for safety as batch support varies by SDK version/model.
        // Note: text-embedding-004 via SDK often expects `model.embedContent(text)`.

        const promises = inputs.map(text => this.model.embedContent(text));
        const results = await Promise.all(promises);

        results.forEach((result, idx) => {
          const { intentIndex, exampleIndex } = meta[idx];
          // Google returns 'embedding.values'
          this.intentStore[intentIndex].embeddings[exampleIndex] = result.embedding.values;
        });

      } else if (this.provider === 'openai') {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: inputs,
        });

        response.data.forEach((item, idx) => {
          const { intentIndex, exampleIndex } = meta[idx];
          this.intentStore[intentIndex].embeddings[exampleIndex] = item.embedding;
        });
      }

      this.initialised = true;
      logger.info(`IntentMatcher embeddings generated using ${this.provider}.`);
    } catch (error) {
      logger.error('Failed to bootstrap intent embeddings', error);
      this.enabled = false;
    }
  }

  async match(message) {
    if (!this.enabled) {
      return null;
    }

    const trimmed = String(message || '').trim();
    if (!trimmed) {
      return null;
    }

    if (this.provider === 'service') {
      return this.matchViaService(trimmed);
    }

    try {
      await this.ensureEmbeddings();
      if (!this.enabled) {
        return null;
      }

      let queryEmbedding = [];

      if (this.provider === 'google') {
        const result = await this.model.embedContent(trimmed);
        queryEmbedding = result.embedding.values;
      } else if (this.provider === 'openai') {
        const embeddingResponse = await this.openai.embeddings.create({
          model: this.model,
          input: trimmed,
        });
        queryEmbedding = embeddingResponse.data?.[0]?.embedding;
      }

      if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
        return null;
      }

      let bestMatch = { score: -1, action: null, example: null };

      this.intentStore.forEach((intent) => {
        intent.embeddings.forEach((exampleEmbedding, index) => {
          const score = cosineSimilarity(queryEmbedding, exampleEmbedding);
          if (score > bestMatch.score) {
            bestMatch = {
              score,
              action: intent.action,
              example: intent.examples[index],
            };
          }
        });
      });

      if (bestMatch.score >= this.threshold && bestMatch.action) {
        return bestMatch;
      }

      return null;
    } catch (error) {
      logger.error('IntentMatcher failed to classify message', error);
      return null;
    }
  }
}

module.exports = IntentMatcher;
