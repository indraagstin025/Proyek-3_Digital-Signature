import 'dotenv/config';
import prisma from '../src/config/prismaClient.js';

const restoreUser = async () => {
  const email = '714230051@std.ulbi.ac.id'; // Email dari log Anda tadi

  console.log(`🔄 Mengembalikan status ${email} ke PREMIUM...`);

  await prisma.user.update({
    where: { email: email },
    data: {
      userStatus: 'PREMIUM',
      // Set expired tahun depan (2026 atau 2027)
      premiumUntil: new Date("2026-12-31T23:59:59.000Z") 
    }
  });

  console.log("✅ User kembali PREMIUM. Siap untuk dev selanjutnya!");
};

restoreUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());