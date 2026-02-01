const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { sendApprovalEmail } = require('../services/emailService');

const prisma = new PrismaClient();

// This is a sample structure. Your actual file might differ.
// The key is the logic inside approveUser.

const approveUser = async (req, res) => {
  const { userId } = req.params;
  const { approvalStatus, approvalNote } = req.body;
  const adminUserId = req.user.id;

  if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
    return res.status(400).json({ error: 'Invalid approval status.' });
  }

  try {
    const userToApprove = await prisma.user.findUnique({ where: { id: Number(userId) } });

    if (!userToApprove) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: {
        approvalStatus,
        approvalNote,
        isActive: approvalStatus === 'APPROVED',
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    // If the approved user is a VENDOR, create a corresponding vendor profile.
    if (updatedUser.role === 'VENDOR' && updatedUser.approvalStatus === 'APPROVED') {
      const existingVendor = await prisma.vendor.findFirst({
        where: { userId: updatedUser.id },
      });

      if (!existingVendor) {
        await prisma.vendor.create({
          data: {
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            userId: updatedUser.id, // Link vendor profile to the user
          },
        });
        logger.info(`Created vendor profile for user ${updatedUser.id}`);
      }
    }

    // Send email notification
    try {
      await sendApprovalEmail(updatedUser.email, updatedUser.name, approvalStatus);
      logger.info(`Approval email sent to ${updatedUser.email}`);
    } catch (emailError) {
      logger.error(`Failed to send approval email to ${updatedUser.email}:`, emailError);
      // Do not fail the request if email fails, but log it.
    }

    res.json({ message: `User has been ${approvalStatus.toLowerCase()}.`, user: updatedUser });
  } catch (error) {
    logger.error(`Error processing user approval for ${userId}:`, error);
    res.status(500).json({ error: 'Failed to process user approval.' });
  }
};

// You would export this function and use it in your admin routes.
// Example of other functions that might be in this file:
const getUsers = async (req, res) => { /* ... */ };
const getAgreements = async (req, res) => { /* ... */ };

module.exports = {
  approveUser,
  // ... other exports
};