"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/actions/creator";
import UsernameAvailabilityInput from "@/components/UsernameAvailabilityInput";
import { validateNoExternalContact } from "@/lib/contentFilter";
import {
  Check,
  AlertCircle,
  Save,
  Camera,
  Image as ImageIcon,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Upload,
} from "lucide-react";
import Link from "next/link";

interface Profile {
  displayName: string;
  bio: string | null;
  subscriptionPriceKoin: number;
  isPublished: number;
  avatarKey?: string | null;
  bannerKey?: string | null;
}

interface Props {
  profile?: Profile | null;
  username: string;
  kycStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
}

export default function ProfileForm({ profile, username, kycStatus = "NONE" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [displayNameState, setDisplayNameState] = useState(profile?.displayName || username);
  const [activeUsername, setActiveUsername] = useState(username);
  const [isUsernameValid, setIsUsernameValid] = useState(true);

  // Estados de imágenes
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Subir archivo a Cloudflare R2 vía URL prefirmada
  const uploadToR2 = async (file: File, category: "avatar" | "banner") => {
    const res = await fetch("/api/uploads/presigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        category,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || `Error subiendo ${category}`);

    await fetch(data.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    return data.key as string;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isUsernameValid) {
      setError("Por favor elige un nombre de usuario disponible antes de guardar.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    const checkName = validateNoExternalContact(formData.get("displayName") as string, "El nombre para mostrar");
    if (!checkName.valid) {
      setError(checkName.error || "Contenido no permitido.");
      setLoading(false);
      return;
    }
    const checkBio = validateNoExternalContact(formData.get("bio") as string, "La biografía");
    if (!checkBio.valid) {
      setError(checkBio.error || "Contenido no permitido.");
      setLoading(false);
      return;
    }

    try {
      if (avatarFile) {
        setUploadProgress("Subiendo foto de perfil...");
        const avatarKey = await uploadToR2(avatarFile, "avatar");
        formData.set("avatarKey", avatarKey);
      }

      if (bannerFile) {
        setUploadProgress("Subiendo foto de portada...");
        const bannerKey = await uploadToR2(bannerFile, "banner");
        formData.set("bannerKey", bannerKey);
      }

      setUploadProgress("Guardando cambios de perfil...");
      const res = await updateProfileAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        setUploadProgress(null);
        return;
      }

      if (res.username) {
        setActiveUsername(res.username);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
      setLoading(false);
      setUploadProgress(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al actualizar perfil.");
      setLoading(false);
      setUploadProgress(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>¡Perfil actualizado con éxito! Ya puedes ver los cambios en tu perfil público.</span>
        </div>
      )}

      {/* 1. SECCIÓN DE IMÁGENES: BANNER Y AVATAR */}
      <div className="space-y-4">
        <label className="block text-xs font-bold text-white uppercase tracking-wider">
          Fotos de Portada y Perfil
        </label>

        {/* Banner de portada */}
        <div className="relative h-44 sm:h-52 w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group">
          {bannerPreview ? (
            <img src={bannerPreview} alt="Portada" className="w-full h-full object-cover" />
          ) : profile?.bannerKey ? (
            <div className="w-full h-full bg-gradient-to-r from-rose-950 via-purple-950 to-slate-900 flex items-center justify-center text-slate-500">
              <span className="text-xs text-slate-400">Portada actual cargada ✓</span>
            </div>
          ) : (
            <div className="text-center p-4">
              <ImageIcon className="w-8 h-8 text-slate-700 mx-auto mb-1" />
              <span className="text-xs text-slate-400 font-semibold block">
                Foto de Portada / Banner (1200 x 400 px)
              </span>
            </div>
          )}

          <label className="absolute bottom-3 right-3 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer border border-slate-700 transition flex items-center gap-1.5 shadow-md">
            <Camera className="w-3.5 h-3.5 text-rose-400" />
            <span>{bannerPreview || profile?.bannerKey ? "Cambiar Portada" : "Subir Portada"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setBannerFile(f);
                  setBannerPreview(URL.createObjectURL(f));
                }
              }}
            />
          </label>
        </div>

        {/* Avatar / Foto de perfil */}
        <div className="flex items-center gap-4 pt-2">
          <div className="relative w-20 h-20 rounded-2xl bg-slate-950 border-2 border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : profile?.avatarKey ? (
              <span className="text-xs text-emerald-400 font-bold">Foto ✓</span>
            ) : (
              <span className="text-xl font-bold text-white">
                {(profile?.displayName || username)[0]?.toUpperCase() || "K"}
              </span>
            )}
          </div>

          <div>
            <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition inline-flex items-center gap-1.5 border border-slate-700">
              <Upload className="w-3.5 h-3.5 text-rose-400" />
              <span>{avatarPreview || profile?.avatarKey ? "Cambiar Foto de Perfil" : "Subir Foto de Perfil"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setAvatarFile(f);
                    setAvatarPreview(URL.createObjectURL(f));
                  }
                }}
              />
            </label>
            <p className="text-[11px] text-slate-500 mt-1">Formato cuadrado (JPG o PNG de hasta 15MB).</p>
          </div>
        </div>
      </div>

      {/* 2. DATOS DE IDENTIDAD Y TEXTOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 items-start">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Nombre para Mostrar (Público)
          </label>
          <input
            name="displayName"
            type="text"
            required
            value={displayNameState}
            onChange={(e) => setDisplayNameState(e.target.value)}
            placeholder="ej: Vanessa Gómez"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden"
          />
        </div>

        <div>
          <UsernameAvailabilityInput
            initialUsername={activeUsername}
            currentUsername={activeUsername}
            displayNameHint={displayNameState}
            label="Nombre de Usuario (Enlace del perfil)"
            onValidityChange={(valid) => setIsUsernameValid(valid)}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          Biografía y Texto de Bienvenida (Con Emojis y menciones)
        </label>
        <textarea
          name="bio"
          rows={3}
          defaultValue={profile?.bio || ""}
          placeholder="¡Hola! Bienvenidos a mi perfil oficial en KONTENIDO 💋 Subo contenido exclusivo todas las semanas ✨"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden resize-none"
        />
      </div>

      {/* 3. ESTADO DE VERIFICACIÓN (KYC) */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              kycStatus === "APPROVED"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : kycStatus === "PENDING"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            }`}
          >
            {kycStatus === "APPROVED" ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-white text-xs font-bold">
              {kycStatus === "APPROVED"
                ? "Cuenta Verificada por Super Admin ✓"
                : kycStatus === "PENDING"
                ? "Verificación de Cédula en Revisión"
                : "FALTA VERIFICAR: Cédula y Mayoría de Edad"}
            </h4>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {kycStatus === "APPROVED"
                ? "Tu documento fue validado. Tu insignia de Verificada está activa en tu perfil."
                : kycStatus === "PENDING"
                ? "Tus fotos están siendo revisadas por la administración. Pronto recibirás la aprobación."
                : "Debes subir tu cédula venezolana y selfie para que tu cuenta aparezca Verificada y puedas publicar."}
            </p>
          </div>
        </div>

        {kycStatus !== "APPROVED" && (
          <Link
            href="/panel/kyc"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shrink-0 flex items-center gap-1.5 shadow-md shadow-rose-600/20"
          >
            <span>{kycStatus === "PENDING" ? "Ver mis Documentos" : "Validar mi Cédula"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* 4. PRECIO BASE DE SUSCRIPCIÓN */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          Precio Base de Suscripción Mensual (en KOIN)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-2.5 text-amber-400 text-xs font-bold">🪙 KOIN</span>
          <input
            name="subscriptionPriceKoin"
            type="number"
            step="0.5"
            min="1"
            required
            defaultValue={profile?.subscriptionPriceKoin || 10.0}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-20 pr-4 text-white text-sm focus:border-rose-500 focus:outline-hidden"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
          <span>1 KOIN ≈ 1 USDT.</span>
          <Link
            href="/panel/suscripciones"
            className="text-rose-400 hover:underline font-semibold"
          >
            Configurar hasta 3 planes de suscripción (1 mes, 3 meses, etc.) ➔
          </Link>
        </div>
      </div>

      {/* 5. VISIBILIDAD */}
      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-white block">Perfil público publicado</span>
          <span className="text-[11px] text-slate-500">
            Si está desactivado, el perfil permanece como borrador privado.
          </span>
        </div>
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={profile?.isPublished === 1}
          className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500 cursor-pointer"
        />
      </div>

      {uploadProgress && (
        <div className="p-3 bg-slate-950 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium text-center animate-pulse">
          {uploadProgress}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 px-4 rounded-xl transition text-sm shadow-lg shadow-rose-600/30 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {loading ? "Guardando en Cloudflare R2..." : "Guardar Cambios del Perfil"}
      </button>
    </form>
  );
}
