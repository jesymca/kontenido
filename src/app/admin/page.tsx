import { db } from "@/lib/db";
import {
  users,
  kycDocuments,
  walletTransactions,
  downloadInfractions,
  posts,
  wallets,
} from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import Link from "next/link";
import {
  Users,
  Coins,
  FileCheck,
  AlertOctagon,
  ImageIcon,
  ArrowRight,
  Shield,
  Sparkles,
} from "lucide-react";

/**
 * Resumen Global del SUPER_ADMIN (/admin)
 */
export default async function AdminDashboardPage() {
  const totalUsers = await db.$count(users);
  const totalCreators = await db.$count(users, eq(users.role, "CREATOR"));
  const totalConsumers = await db.$count(users, eq(users.role, "CONSUMER"));

  const pendingKyc = await db.$count(kycDocuments, eq(kycDocuments.status, "PENDING"));
  const pendingTopups = await db.$count(
    walletTransactions,
    eq(walletTransactions.status, "PENDING")
  );
  const totalInfractions = await db.$count(downloadInfractions);
  const totalPosts = await db.$count(posts, eq(posts.isDeleted, 0));

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
          <Shield className="w-7 h-7 text-red-500" />
          Panel de Control SUPER_ADMIN
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Gestión integral de KONTENIDO: usuarios, transacciones, moderación y parámetros globales.
        </p>
      </div>

      {/* Tarjetas de métricas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">Total Usuarios</span>
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-white">{totalUsers}</div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-2">
            <span>{totalCreators} Creadoras</span> • <span>{totalConsumers} Consumidores</span>
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">Recargas por Validar</span>
            <Coins className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">{pendingTopups}</div>
          <Link
            href="/admin/recargas"
            className="text-[11px] text-rose-400 hover:underline mt-2 inline-flex items-center gap-1 font-semibold"
          >
            Revisar comprobantes <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">Solicitudes KYC</span>
            <FileCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">{pendingKyc}</div>
          <Link
            href="/admin/kyc"
            className="text-[11px] text-rose-400 hover:underline mt-2 inline-flex items-center gap-1 font-semibold"
          >
            Validar cédulas VE <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400">Infracciones Anti-Descarga</span>
            <AlertOctagon className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-400">{totalInfractions}</div>
          <Link
            href="/admin/infracciones"
            className="text-[11px] text-rose-400 hover:underline mt-2 inline-flex items-center gap-1 font-semibold"
          >
            Ver suspensiones <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Accesos rápidos administrativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/usuarios"
          className="p-6 bg-slate-900 border border-slate-800 rounded-3xl hover:border-slate-700 transition flex flex-col justify-between group shadow-lg"
        >
          <div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1 group-hover:text-blue-400 transition">
              CRUD de Usuarios
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Administra roles (CREATOR, CONSUMER, AGENCY, SUPER_ADMIN), suspende o reactiva cuentas, y modifica niveles manualmente.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-blue-400">
            <span>Gestionar usuarios</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/admin/niveles"
          className="p-6 bg-slate-900 border border-slate-800 rounded-3xl hover:border-slate-700 transition flex flex-col justify-between group shadow-lg"
        >
          <div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1 group-hover:text-amber-400 transition">
              Niveles 0 a 100 y Marcos
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configura los montos de inversión en $ requeridos para cada nivel, los marcos visuales y a partir de qué monto habilitar descarga VIP.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
            <span>Configurar escala</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/admin/membresias"
          className="p-6 bg-slate-900 border border-slate-800 rounded-3xl hover:border-slate-700 transition flex flex-col justify-between group shadow-lg"
        >
          <div>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1 group-hover:text-rose-400 transition">
              Membresías VIP (Ultra, Pro)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Crea y edita distintivos especiales con frases pequeñas (Ultra, Pro, Silver, Golden, Platinum), precios en KOIN y permisos extra.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-rose-400">
            <span>Administrar badges</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}
