const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  if (existing) {
    console.log("SUPER_ADMIN already exists. Skipping seed.");
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL || "naufal@gmail.com";
  const name = process.env.SEED_ADMIN_NAME || "Super Admin";
  let password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    password = crypto.randomBytes(9).toString("base64url");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  console.log("Seeded SUPER_ADMIN user:");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(
    "Store these credentials securely. They will not be shown again.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
