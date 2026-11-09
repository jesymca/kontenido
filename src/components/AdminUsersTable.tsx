"use client";

import { useState } from "react";
import UserLevelBadge from "./UserLevelBadge";
import { updateAdminUserAction, toggleUserSuspensionAction } from "@/actions/admin";
import CreatorContentModal, { CreatorPostModalItem } from "./CreatorContentModal";
import {
  Edit2,
  ShieldAlert,
  Check,
  X,
  Search,
  Download,
  ExternalLink,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Link from "next/link";

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: "SUPER_ADMIN" | "CREATOR" | "CONSUMER" | "AGENCY";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  level: number;
  vipMembershipId?: string | null;
  allowDownload: number;
  suspensionReason?: string | null;
  createdAt: string;
  profile?: {
    displayName?: string | null;
    bio?: string | null;
    avatarKey?: string | null;
    bannerKey?: string | null;
  } | null;
  posts?: CreatorPostModalItem[];
}

interface VipMembership {
  id: string;
  name: string;
  badgeText: string;
  badgeColor?: string;
}

interface Props {
  users: UserItem[];
  memberships: VipMembership[];
}

export default function AdminUsersTable({ users, memberships }: Props) {
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [contentModalUser, setContentModalUser] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados de paginación
  const [pageSize, setPageSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.profile?.displayName && u.profile.displayName.toLowerCase().includes(search.toLowerCase()))
  );

  // Cálculos de paginación
  const totalUsers = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalUsers);
  const paginatedUsers = filtered.slice(startIndex, endIndex);

  // Resetear a la primera página cuando cambie la búsqueda o el tamaño de página
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateAdminUserAction(formData);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setEditingUser(null);
      window.location.reload();
    } catch (e) {
      alert("Error actualizando usuario.");
      setLoading(false);
    }
  };

  const handleToggleSuspension = async (u: UserItem) => {
    const isSuspended = u.status === "SUSPENDED";
    const promptMsg = isSuspended
      ? "¿Deseas reactivar esta cuenta?"
      : "Ingresa el motivo de la suspensión para el usuario:";

    let reason: string | undefined = undefined;
    if (!isSuspended) {
      const r = prompt(promptMsg, "Intento de descarga no autorizada o infracción de normas");
      if (r === null) return;
      reason = r;
    } else {
      if (!confirm(promptMsg)) return;
    }

    await toggleUserSuspensionAction(u.id, reason);
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros y Configuración de Paginación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Buscador */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por usuario, correo o nombre..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-hidden"
          />
        </div>

        {/* Selector de Tamaño de Página */}
        <div className="flex items-center gap-2 text-xs text-slate-400 self-end sm:self-auto">
          <span>Mostrar:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-xl py-1.5 px-3 text-xs text-white font-bold focus:border-rose-500 focus:outline-hidden"
          >
            <option value={20}>20 por pág</option>
            <option value={30}>30 por pág</option>
            <option value={50}>50 por pág</option>
            <option value={100}>100 por pág</option>
          </select>
          <span className="text-[11px] text-slate-500">
            ({totalUsers} {totalUsers === 1 ? "usuario" : "usuarios"})
          </span>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Usuario & Nivel</th>
                <th className="py-3.5 px-4">Correo</th>
                <th className="py-3.5 px-4">Rol</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Descarga VIP</th>
                <th className="py-3.5 px-4">Perfil & Contenido</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4">
                      {(() => {
                        const userVip = memberships.find((m) => m.id === u.vipMembershipId);
                        return (
                          <div className="space-y-0.5">
                            <UserLevelBadge
                              level={u.level || 0}
                              username={u.username}
                              vipBadgeText={userVip?.badgeText}
                              vipBadgeColor={userVip?.badgeColor}
                            />
                            {u.profile?.displayName && u.profile.displayName !== u.username && (
                              <span className="text-[10px] text-slate-400 block pl-1">
                                {u.profile.displayName}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.status === "ACTIVE" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                          Activo
                        </span>
                      )}
                      {u.status === "PENDING" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
                          Pendiente
                        </span>
                      )}
                      {u.status === "SUSPENDED" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">
                          Suspendido
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {u.allowDownload === 1 ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                          <Check className="w-3.5 h-3.5" /> Autorizada
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Prohibida</span>
                      )}
                    </td>

                    {/* Acceso Directo a Perfil Público y Modal de Contenido */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {/* Enlace al perfil público */}
                        <Link
                          href={`/${u.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-semibold transition flex items-center gap-1"
                          title="Abrir perfil público"
                        >
                          <span>Perfil</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </Link>

                        {/* Modal para ver contenidos de la creadora */}
                        {u.role === "CREATOR" ? (
                          <button
                            type="button"
                            onClick={() => setContentModalUser(u)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition flex items-center gap-1"
                            title={`Ver contenidos subidos (${u.posts?.length || 0})`}
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>Contenidos ({u.posts?.length || 0})</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">No es Creadora</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          title="Editar usuario"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSuspension(u)}
                          className={`p-1.5 rounded-lg transition ${
                            u.status === "SUSPENDED"
                              ? "text-emerald-400 hover:bg-emerald-500/20"
                              : "text-red-400 hover:bg-red-500/20"
                          }`}
                          title={u.status === "SUSPENDED" ? "Reactivar cuenta" : "Suspender usuario"}
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginador Inferior */}
        {totalUsers > 0 && (
          <div className="p-4 bg-slate-950/70 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">
              Mostrando del <strong className="text-white">{startIndex + 1}</strong> al{" "}
              <strong className="text-white">{endIndex}</strong> de{" "}
              <strong className="text-white">{totalUsers}</strong> usuarios
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
                title="Primera página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 font-bold text-white bg-slate-900 border border-slate-800 rounded-lg">
                Pág {safeCurrentPage} de {totalPages}
              </span>

              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
                title="Última página"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de edición completa de usuario */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">
              Editar Usuario: @{editingUser.username}
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="hidden" name="userId" value={editingUser.id} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rol</label>
                  <select
                    name="role"
                    defaultValue={editingUser.role}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="CONSUMER">CONSUMER</option>
                    <option value="CREATOR">CREATOR</option>
                    <option value="AGENCY">AGENCY</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Estado</label>
                  <select
                    name="status"
                    defaultValue={editingUser.status}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nivel de Inversor (0 a 100)
                  </label>
                  <input
                    name="level"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={editingUser.level}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Membresía VIP Asignada
                  </label>
                  <select
                    name="vipMembershipId"
                    defaultValue={editingUser.vipMembershipId || ""}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="">Ninguna</option>
                    {memberships.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.badgeText})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Permiso de Descarga VIP</span>
                  <span className="text-[11px] text-slate-500">
                    Habilita la descarga nativa de medios a este usuario.
                  </span>
                </div>
                <select
                  name="allowDownload"
                  defaultValue={editingUser.allowDownload.toString()}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  <option value="0">Prohibida</option>
                  <option value="1">Autorizada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Motivo de suspensión (si aplica)
                </label>
                <input
                  name="suspensionReason"
                  type="text"
                  defaultValue={editingUser.suspensionReason || ""}
                  placeholder="ej: Intento de descarga no autorizada detectado"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/30"
                >
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para visualizar los contenidos y publicaciones de la creadora */}
      {contentModalUser && (
        <CreatorContentModal
          username={contentModalUser.username}
          displayName={contentModalUser.profile?.displayName}
          posts={contentModalUser.posts || []}
          onClose={() => setContentModalUser(null)}
        />
      )}
    </div>
  );
}
