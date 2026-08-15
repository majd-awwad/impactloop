import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

export const EMAIL_VERIFICATION_REQUIRED_CODE = 'EMAIL_VERIFICATION_REQUIRED';

export const userRequiresEmailVerification = (user: {
  emailVerificationRequired: boolean;
  emailVerifiedAt: Date | null;
}): boolean =>
  user.emailVerificationRequired && user.emailVerifiedAt === null;

export const assertEmailVerifiedForMarketplaceCommitment = async (
  userId: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      emailVerificationRequired: true,
      emailVerifiedAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  if (userRequiresEmailVerification(user)) {
    throw new AppError(
      'Please verify your email before creating a new marketplace commitment.',
      403,
      EMAIL_VERIFICATION_REQUIRED_CODE,
    );
  }
};
