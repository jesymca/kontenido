import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./index";
import { banks, users, profiles, wallets, settings, userLevels, vipMemberships } from "./schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

/**
 * Script de inicialización (Seed) para la base de datos de KONTENIDO
 * Carga:
 * - 30 bancos oficiales venezolanos
 * - Usuario SUPER_ADMIN (herrejose@gmail.com / JyM01012023)
 * - Configuraciones del sistema (fee, paridad, billeteras)
 * - Escala completa de niveles de usuario (0 al 100)
 * - Membresías VIP iniciales (Ultra, Pro, Platinum, Golden, Silver, Bronce)
 */
async function seed() {
  console.log("🌱 Iniciando seed de la base de datos KONTENIDO...");

  // 1. Seed de los 30 Bancos de Venezuela
  const bankList = [
    { id: 1, nombreBanco: "100% Banco", codigo: "0156" },
    { id: 2, nombreBanco: "Bancamiga", codigo: "0172" },
    { id: 3, nombreBanco: "Banco Activo", codigo: "0171" },
    { id: 4, nombreBanco: "Banco Agrícola de Venezuela", codigo: "0166" },
    { id: 5, nombreBanco: "Banco Caroní", codigo: "0128" },
    { id: 6, nombreBanco: "Banco de Comercio Exterior (BANCOEX)", codigo: "0601" },
    { id: 7, nombreBanco: "Banco de Desarrollo Económico y Social (BANDES)", codigo: "0603" },
    { id: 8, nombreBanco: "Banco de la Fuerza Armada Nacional Bolivariana (BANFANB)", codigo: "0177" },
    { id: 9, nombreBanco: "Banco de la Gente Emprendedora (Bangente)", codigo: "0146" },
    { id: 10, nombreBanco: "Banco de Venezuela", codigo: "0102" },
    { id: 11, nombreBanco: "Banco del Caribe (Bancaribe)", codigo: "0114" },
    { id: 12, nombreBanco: "Banco del Tesoro", codigo: "0163" },
    { id: 13, nombreBanco: "Banco Digital de los Trabajadores", codigo: "0175" },
    { id: 14, nombreBanco: "Banco Exterior", codigo: "0115" },
    { id: 15, nombreBanco: "Banco Internacional de Desarrollo", codigo: "0173" },
    { id: 16, nombreBanco: "Banco Nacional de Crédito (BNC)", codigo: "0191" },
    { id: 17, nombreBanco: "Banco Nacional de Vivienda y Hábitat (BANAVIH)", codigo: "0602" },
    { id: 18, nombreBanco: "Banco Plaza", codigo: "0138" },
    { id: 19, nombreBanco: "Banco Provincial", codigo: "0108" },
    { id: 20, nombreBanco: "Banco Sofitasa", codigo: "0137" },
    { id: 21, nombreBanco: "Bancrecer", codigo: "0168" },
    { id: 22, nombreBanco: "Banesco", codigo: "0134" },
    { id: 23, nombreBanco: "Banplus", codigo: "0174" },
    { id: 24, nombreBanco: "BFC Banco Fondo Común", codigo: "0151" },
    { id: 25, nombreBanco: "Del Sur Banco Universal", codigo: "0157" },
    { id: 26, nombreBanco: "Instituto Municipal de Crédito Popular (IMCP)", codigo: "0149" },
    { id: 27, nombreBanco: "Mercantil", codigo: "0105" },
    { id: 28, nombreBanco: "N58 Banco Digital", codigo: "0178" },
    { id: 29, nombreBanco: "R4 Banco Microfinanciero", codigo: "0169" },
    { id: 30, nombreBanco: "Venezolano de Crédito", codigo: "0104" },
  ];

  for (const b of bankList) {
    await db
      .insert(banks)
      .values(b)
      .onConflictDoUpdate({
        target: banks.id,
        set: { nombreBanco: b.nombreBanco, codigo: b.codigo },
      });
  }
  console.log("✅ 30 Bancos de Venezuela registrados.");

  // 2. Seed de Configuraciones Globales
  const now = new Date().toISOString();
  const defaultSettings = [
    { key: "platform_fee_pct", value: "15.0", description: "Comisión estándar de la plataforma en %" },
    { key: "fee_tier1_max", value: "500.0", description: "Volumen acumulado máximo para Nivel 1 ($)" },
    { key: "fee_tier1_pct", value: "20.0", description: "Comisión Nivel 1 para creadoras iniciales (%)" },
    { key: "fee_tier2_max", value: "2000.0", description: "Volumen acumulado máximo para Nivel 2 ($)" },
    { key: "fee_tier2_pct", value: "15.0", description: "Comisión Nivel 2 para creadoras intermedias (%)" },
    { key: "fee_tier3_pct", value: "10.0", description: "Comisión Nivel 3 para creadoras Top con mayor monto general (%)" },
    { key: "fallback_usd_ves_rate", value: "1030.88", description: "Tasa paralelo de respaldo si la API ve.dolarapi.com no responde" },
    { key: "koin_usd_parity", value: "1.0", description: "Paridad fija de 1 KOIN en relación al USD" },
    { key: "usdt_trc20_address", value: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", description: "Dirección USDT TRC20 para recargas" },
    { key: "usdt_bep20_address", value: "0x71C83638209121a91e57c61775e54d5885dc8bA8", description: "Dirección USDT BEP20 para recargas" },
    { key: "vip_download_min_spent", value: "100.0", description: "Inversión acumulada mínima en $ para permitir descarga a usuarios VIP" },
  ];

  for (const s of defaultSettings) {
    await db
      .insert(settings)
      .values({ ...s, updatedAt: now })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: s.value, description: s.description, updatedAt: now },
      });
  }
  console.log("✅ Configuraciones globales del sistema registradas.");

  // 3. Seed de Niveles de Usuario (0 al 100)
  for (let lvl = 0; lvl <= 100; lvl++) {
    let minSpent = 0;
    let maxSpent = 0;
    let title = "Novato";
    let badgeFrame = "frame-default";
    let badgeColor = "#94a3b8"; // Slate
    let canDownload = 0;

    if (lvl === 0) {
      minSpent = 0;
      maxSpent = 0.99;
      title = "Inicial";
      badgeFrame = "frame-iron";
      badgeColor = "#64748b";
    } else if (lvl === 1) {
      minSpent = 1.0;
      maxSpent = 20.0;
      title = "Bronce I";
      badgeFrame = "frame-bronze";
      badgeColor = "#b45309";
    } else if (lvl === 2) {
      minSpent = 21.0;
      maxSpent = 50.0;
      title = "Bronce II";
      badgeFrame = "frame-bronze-shimmer";
      badgeColor = "#d97706";
    } else if (lvl === 3) {
      minSpent = 51.0;
      maxSpent = 100.0;
      title = "Plata I";
      badgeFrame = "frame-silver";
      badgeColor = "#94a3b8";
    } else if (lvl === 4) {
      minSpent = 101.0;
      maxSpent = 150.0;
      title = "Plata II";
      badgeFrame = "frame-silver-glow";
      badgeColor = "#cbd5e1";
      canDownload = 1; // Super Admin habilita descarga a usuarios VIP a partir de $100
    } else if (lvl === 5) {
      minSpent = 151.0;
      maxSpent = 200.0;
      title = "Oro I";
      badgeFrame = "frame-gold";
      badgeColor = "#eab308";
      canDownload = 1;
    } else {
      // Niveles 6 a 100
      minSpent = 201.0 + (lvl - 6) * 50.0;
      maxSpent = minSpent + 49.99;
      canDownload = 1;
      if (lvl <= 15) {
        title = `Oro ${lvl - 4}`;
        badgeFrame = "frame-gold-glow";
        badgeColor = "#f59e0b";
      } else if (lvl <= 35) {
        title = `Platino ${lvl - 15}`;
        badgeFrame = "frame-platinum";
        badgeColor = "#06b6d4";
      } else if (lvl <= 60) {
        title = `Diamante ${lvl - 35}`;
        badgeFrame = "frame-diamond";
        badgeColor = "#3b82f6";
      } else if (lvl <= 85) {
        title = `Maestro ${lvl - 60}`;
        badgeFrame = "frame-master";
        badgeColor = "#8b5cf6";
      } else {
        title = `Leyenda ${lvl - 85}`;
        badgeFrame = "frame-legend";
        badgeColor = "#ec4899";
      }
    }

    await db
      .insert(userLevels)
      .values({
        levelNumber: lvl,
        minSpentUsd: minSpent,
        maxSpentUsd: maxSpent,
        title,
        badgeFrame,
        badgeColor,
        canDownload,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: userLevels.levelNumber,
        set: {
          minSpentUsd: minSpent,
          maxSpentUsd: maxSpent,
          title,
          badgeFrame,
          badgeColor,
          canDownload,
        },
      });
  }
  console.log("✅ Escala completa de niveles 0 a 100 registrada.");

  // 4. Seed de Membresías VIP
  const defaultMemberships = [
    {
      id: "vip-ultra",
      name: "Ultra",
      slug: "ultra",
      badgeText: "ULTRA",
      badgeColor: "vip-badge-ultra",
      priceKoin: 50.0,
      durationDays: 30,
      allowDownload: 1,
      description: "Acceso ilimitado, descarga de contenido habilitada y halo cósmico Ultra.",
    },
    {
      id: "vip-pro",
      name: "Pro",
      slug: "pro",
      badgeText: "PRO",
      badgeColor: "vip-badge-pro",
      priceKoin: 35.0,
      durationDays: 30,
      allowDownload: 1,
      description: "Badge Pro distintivo, atención prioritaria y descarga autorizada.",
    },
    {
      id: "vip-platinum",
      name: "Platinum",
      slug: "platinum",
      badgeText: "PLATINUM",
      badgeColor: "vip-badge-platinum",
      priceKoin: 25.0,
      durationDays: 30,
      allowDownload: 1,
      description: "Cromo glacial diamantino y soporte preferente.",
    },
    {
      id: "vip-golden",
      name: "Golden",
      slug: "golden",
      badgeText: "GOLDEN",
      badgeColor: "vip-badge-golden",
      priceKoin: 20.0,
      durationDays: 30,
      allowDownload: 0,
      description: "Oro Imperial 24K en perfil, chat y publicaciones.",
    },
    {
      id: "vip-silver",
      name: "Silver",
      slug: "silver",
      badgeText: "SILVER",
      badgeColor: "vip-badge-silver",
      priceKoin: 15.0,
      durationDays: 30,
      allowDownload: 0,
      description: "Plata esterlina líquida con destello de prestigio.",
    },
    {
      id: "vip-bronce",
      name: "Bronce",
      slug: "bronce",
      badgeText: "BRONCE",
      badgeColor: "vip-badge-bronce",
      priceKoin: 10.0,
      durationDays: 30,
      allowDownload: 0,
      description: "Cobre radiante incandescente de distinción inicial.",
    },
  ];

  for (const m of defaultMemberships) {
    await db
      .insert(vipMemberships)
      .values({ ...m, isActive: 1, createdAt: now })
      .onConflictDoUpdate({
        target: vipMemberships.id,
        set: { ...m, isActive: 1 },
      });
  }
  console.log("✅ Membresías VIP iniciales registradas.");

  // 5. Seed del SUPER_ADMIN (herrejose@gmail.com / JyM01012023)
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || "herrejose@gmail.com";
  const adminRawPassword = process.env.SUPER_ADMIN_PASSWORD || "JyM01012023";
  const passwordHash = await bcrypt.hash(adminRawPassword, 12);
  const adminId = "00000000-0000-4000-8000-000000000001";

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });

  if (!existingAdmin) {
    await db.insert(users).values({
      id: adminId,
      username: "admin",
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      kycStatus: "APPROVED",
      level: 100,
      allowDownload: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(profiles).values({
      userId: adminId,
      displayName: "Administrador KONTENIDO",
      bio: "Cuenta de administración general y soporte de KONTENIDO.",
      subscriptionPriceKoin: 0.0,
      isPublished: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(wallets).values({
      userId: adminId,
      balanceKoin: 10000.0,
      totalSpentUsd: 5000.0,
      totalEarnedKoin: 0.0,
      updatedAt: now,
    });

    console.log(`✅ Usuario SUPER_ADMIN creado exitosamente (${adminEmail}).`);
  } else {
    await db
      .update(users)
      .set({
        passwordHash,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        kycStatus: "APPROVED",
        level: 100,
        allowDownload: 1,
        updatedAt: now,
      })
      .where(eq(users.id, existingAdmin.id));
    console.log(`ℹ️ Usuario SUPER_ADMIN actualizado (${adminEmail}).`);
  }

  console.log("🚀 Seed completado exitosamente.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error ejecutando seed:", err);
    process.exit(1);
  });
