"use client";

import { useState } from "react";
import { saveUserLevelConfigAction } from "@/actions/admin";
import { Edit2, Check, Download, Shield, Sparkles, X } from "lucide-react";
import { getLevelFrameClass } from "./UserLevelBadge";

interface UserLevelItem {
  id: number;
  levelNumber: number;
  minSpentUsd: number;
  maxSpentUsd: number;
  title: string;
  badgeFrame: string;
  badgeColor: string;
  canDownload: number;
}

interface Props {
  initialLevels: UserLevelItem[];
}

export default function AdminLevelsManager({ initialLevels }: Props) {
  const [levels, setLevels] = useState(initialLevels);
  const [editingLevel, setEditingLevel] = useState<UserLevelItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = levels.filter(
    (l) =>
      l.levelNumber.toString().includes(filter) ||
      l.title.toLowerCase().includes(filter.toLowerCase())
  );

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await saveUserLevelConfigAction(formData);
      if (res.error) {
        alert(res.error);
        setLoading(false);
        return;
      }
      setEditingLevel(null);
      window.location.reload();
    } catch (err) {
      alert("Error guardando configuración de nivel.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Explicación de la tabla base */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-300 leading-relaxed flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block mb-0.5">
            Distribución Base de Inversión (Nivel 0 al 100)
          </span>
          <p>
            Tabla configurada: <strong>$1 a $20 (Nivel 1)</strong>, <strong>$21 a $50 (Nivel 2)</strong>, <strong>$51 a $100 (Nivel 3)</strong>, <strong>$101 a $150 (Nivel 4)</strong>, <strong>$151 a $200 (Nivel 5)</strong>... Cada nivel otorga un número enmarcado antes del nombre visible tanto para creadoras como para consumidores.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por número de nivel o título..."
          className="bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 w-72 focus:border-rose-500 focus:outline-hidden"
        />
        <span className="text-xs text-slate-500">
          Mostrando {filtered.length} de {levels.length} niveles
        </span>
      </div>

      {/* Tabla de Niveles */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Nivel & Marco</th>
                <th className="py-3 px-4">Título del Rango</th>
                <th className="py-3 px-4">Rango de Inversión en $</th>
                <th className="py-3 px-4">Permiso Descarga VIP</th>
                <th className="py-3 px-4 text-right">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((lvl) => {
                const frameClass = getLevelFrameClass(lvl.levelNumber);
                return (
                  <tr key={lvl.levelNumber} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold inline-block ${frameClass}`}
                      >
                        Lv.{lvl.levelNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">{lvl.title}</td>
                    <td className="py-3 px-4 text-amber-400 font-mono font-medium">
                      ${lvl.minSpentUsd.toFixed(2)} — ${lvl.maxSpentUsd.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-4">
                      {lvl.canDownload === 1 ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[11px]">
                          <Download className="w-3.5 h-3.5" /> Descarga Habilitada
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Solo Visualización</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingLevel(lvl)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edición de nivel */}
      {editingLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingLevel(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">
              Configurar Nivel {editingLevel.levelNumber}
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input type="hidden" name="levelNumber" value={editingLevel.levelNumber} />

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Título del Nivel
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingLevel.title}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Inversión Mínima ($)
                  </label>
                  <input
                    name="minSpentUsd"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingLevel.minSpentUsd}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Inversión Máxima ($)
                  </label>
                  <input
                    name="maxSpentUsd"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingLevel.maxSpentUsd}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Permiso de Descarga VIP
                  </span>
                  <span className="text-[11px] text-slate-500">
                    ¿Los usuarios en este nivel pueden descargar contenido?
                  </span>
                </div>
                <select
                  name="canDownload"
                  defaultValue={editingLevel.canDownload.toString()}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  <option value="0">No (Bloqueado)</option>
                  <option value="1">Sí (Autorizado)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLevel(null)}
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
    </div>
  );
}
