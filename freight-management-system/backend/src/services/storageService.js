const fs = require('fs-extra');
const path = require('path');
const { randomUUID } = require('crypto');

class StorageService {
    constructor() {
        this.provider = process.env.STORAGE_PROVIDER || 'local';

        // Config file path
        this.configPath = path.join(__dirname, '../../data/storage-config.json');
        this.localRoot = this.loadConfiguredPath();

        // Ensure root exists if local
        if (this.provider === 'local') {
            fs.ensureDirSync(this.localRoot);
            console.log(`Storage initialized at: ${this.localRoot}`);
        }
    }

    loadConfiguredPath() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = fs.readJsonSync(this.configPath);
                if (config.storageRoot && typeof config.storageRoot === 'string' && config.storageRoot.trim() !== '') {
                    return path.resolve(config.storageRoot);
                }
            }
        } catch (error) {
            console.error('Error reading storage-config.json:', error);
        }

        // Fallback to env or default
        return process.env.STORAGE_LOCAL_ROOT
            ? path.resolve(process.env.STORAGE_LOCAL_ROOT)
            : path.join(__dirname, '../../uploads');
    }

    updateStoragePath(newPath) {
        // Validate path
        const resolvedPath = path.resolve(newPath);
        try {
            fs.ensureDirSync(resolvedPath);
            // Check write permissions by writing a temp file
            const testFile = path.join(resolvedPath, '.write-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);

            // Save config
            fs.ensureDirSync(path.dirname(this.configPath));
            fs.writeJsonSync(this.configPath, { storageRoot: resolvedPath });

            // Update instance
            this.localRoot = resolvedPath;
            return true;
        } catch (error) {
            console.error('Failed to update storage path:', error);
            throw new Error(`Cannot write to path: ${resolvedPath}. ${error.message}`);
        }
    }

    /**
     * Upload a file
     * @param {Buffer} buffer - File content
     * @param {string} directory - Subdirectory (e.g., 'agreements', 'invoices')
     * @param {string} originalFilename - Original filename for extension extraction
     * @param {Object} options - { overwrite: boolean, filename: string }
     * @returns {Promise<Object>} - { key, url, path }
     */
    async upload(buffer, directory, originalFilename, options = {}) {
        if (this.provider === 'local') {
            return this.uploadLocal(buffer, directory, originalFilename, options);
        }
        throw new Error(`Provider ${this.provider} not implemented`);
    }

    async uploadLocal(buffer, directory, originalFilename, options) {
        const ext = path.extname(originalFilename);
        const filename = options.filename || `${randomUUID()}${ext}`;
        const relativeKey = path.join(directory, filename); // Stored in DB as "directory/filename"
        const absolutePath = path.join(this.localRoot, relativeKey);

        await fs.ensureDir(path.dirname(absolutePath));
        await fs.writeFile(absolutePath, buffer);

        // URL generation assumes server serves 'uploads' at /uploads
        // If STORAGE_LOCAL_ROOT is external, serving might need a dedicated endpoint
        const url = `/uploads/${directory}/${filename}`.replace(/\\/g, '/');

        return {
            key: relativeKey.replace(/\\/g, '/'), // Normalized key
            url, // Access URL
            path: absolutePath
        };
    }

    /**
     * Delete a file
     * @param {string} key - Relative path stored in DB
     */
    async delete(key) {
        if (this.provider === 'local') {
            const absolutePath = path.join(this.localRoot, key);
            if (await fs.pathExists(absolutePath)) {
                await fs.remove(absolutePath);
                return true;
            }
            return false;
        }
        throw new Error(`Provider ${this.provider} not implemented`);
    }

    /**
     * Get absolute path (Internal use)
     */
    getAbsolutePath(key) {
        return path.join(this.localRoot, key);
    }
}

module.exports = new StorageService();
