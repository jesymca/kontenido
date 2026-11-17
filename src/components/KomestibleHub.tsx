"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Flame,
  Heart,
  Camera,
  Upload,
  Trash2,
  Sparkles,
  MessageCircleHeart,
  Filter,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Coins,
  UserCheck,
  Loader2,
  Lock,
} from "lucide-react";
import KomestibleSwipeDeck from "@/components/KomestibleSwipeDeck";
import MediaCaptureModal from "@/components/MediaCaptureModal";
import {
  getDiscoveryDeckAction,
  uploadKomestiblePhotoAction,
  deleteKomestiblePhotoAction,
  updateMyKomestibleIdentityAction,
  promoteToCreatorFromKomestibleAction,
  type KomestibleConfig,
  type KomestibleDeckCard,
  type LikeQuotaInfo,
} from "@/actions/komestible";
import { COUNTRIES, USER_GENDERS } from "@/lib/countries";

export interface MyKomestiblePhotoItem {
  id: string;
  mediaKey: string;
  caption: string | null;
  likesReceived: number;
  avgRating: number;
  ratingCount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

interface Props {
  config: KomestibleConfig;
  currentUser: {
    id: string;
    username: string;
    role: string;
    gender: string | null;
    country: string;
  };
  initialQuota: LikeQuotaInfo;
  initialDeck: KomestibleDeckCard[];
  initialMyPhotos: MyKomestiblePhotoItem[];
  initialMatchesCount: number;
  pendingAdmirersCount: number;
}

export default function KomestibleHub({
  config,
  currentUser,
  initialQuota,
  initialDeck,
  initialMyPhotos,
  initialMatchesCount,
  pendingAdmirersCount,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"discover" | "myphotos">("discover");
  const [quota, setQuota] = useState<LikeQuotaInfo>(initialQuota);
  const [deck, setDeck] = useState<KomestibleDeckCard[]>(initialDeck);
  const [myPhotos, setMyPhotos] = useState<MyKomestiblePhotoItem[]>(initialMyPhotos);
  const [matchesCount, setMatchesCount] = useState(initialMatchesCount);

  // Onboarding de género/país si no está definido todavía
  const [needsIdentity, setNeedsIdentity] = useState(!currentUser.gender);
  const [idGender, setIdGender] = useState<string>(currentUser.gender || "HOMBRE");
  const [idCountry, setIdCountry] = useState<string>(currentUser.country || "VE");
  const [savingIdentity, setSavingIdentity] = useState(false);

  // Filtros de descubrimiento
  const [genderFilter, setGenderFilter] = useState<string>("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [loadingDeck, setLoadingDeck] = useState(false);

  // Subida de fotos en KOMESTIBLE
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Conversión a Creadora
  const [promoting, setPromoting] = useState(false);

  const totalMyLikes = myPhotos.reduce((acc, p) => acc + (p.likesReceived || 0), 0);
  const totalRatingSum = myPhotos.reduce(
    (acc, p) => acc + (p.avgRating || 0) * (p.ratingCount || 0),
    0
  );
  const totalRatingCnt = myPhotos.reduce((acc, p) => acc + (p.ratingCount || 0), 0);
  const avgMyScore = totalRatingCnt > 0 ? (totalRatingSum / totalRatingCnt).toFixed(1) : "—";

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIdentity(true);
    const fd = new FormData();
    fd.set("gender", idGender);
    fd.set("country", idCountry);
    try {
      const res = await updateMyKomestibleIdentityAction(fd);
      if (res.success) {
        setNeedsIdentity(false);
        window.location.reload();
      }
    } finally {
      setSavingIdentity(false);
    }
  };

  const applyFilters = async (nextGender: string, nextCountry: string) => {
    setGenderFilter(nextGender);
    setCountryFilter(nextCountry);
    setLoadingDeck(true);
    try {
      const res = await getDiscoveryDeckAction({
        genderFilter: nextGender,
        countryFilter: nextCountry,
      });
      if (res.success) {
        setDeck(res.cards);
      }
    } finally {
      setLoadingDeck(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const presignedRes = await fetch("/api/uploads/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "image/jpeg",
          sizeBytes: file.size,
          category: "komestible",
        }),
      });
      const presignedData = await presignedRes.json();
      if (!presignedRes.ok || !presignedData.success) {
        throw new Error(presignedData.error || "Error preparando subida de foto.");
      }

      const putRes = await fetch(presignedData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!putRes.ok) {
        throw new Error(`Error al subir foto a R2 (HTTP ${putRes.status}).`);
      }

      const saveRes = await uploadKomestiblePhotoAction({
        mediaKey: presignedData.key,
        caption,
      });

      if (saveRes.error) {
        throw new Error(saveRes.error);
      }

      setMyPhotos((prev) => [
        {
          id: saveRes.photoId!,
          mediaKey: presignedData.key,
          caption: caption.trim() || null,
          likesReceived: 0,
          avgRating: 0,
          ratingCount: 0,
          status: (saveRes.status as any) || "APPROVED",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setCaption("");
      setUploadSuccess(saveRes.message || "Foto subida correctamente.");
    } catch (err: any) {
      setUploadError(err.message || "Error subiendo la foto.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("¿Eliminar esta foto de KOMESTIBLE?")) return;
    const res = await deleteKomestiblePhotoAction(photoId);
    if (res.success) {
      setMyPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  };

  const handlePromoteToCreator = async () => {
    if (
      !confirm(
        "¿Deseas perfilar tu cuenta como Creadora de Contenido en KONTENIDO para monetizar con suscripciones y contenido exclusivo?"
      )
    ) {
      return;
    }
    setPromoting(true);
    try {
      const res = await promoteToCreatorFromKomestibleAction();
      if (res.error) {
        alert(res.error);
        setPromoting(false);
        return;
      }
      if (res.redirectTo) {
        window.location.href = res.redirectTo;
      } else {
        router.push("/panel");
      }
    } catch {
      alert("Error al activar perfil de creadora.");
      setPromoting(false);
    }
  };

  if (!config.enabled && currentUser.role !== "SUPER_ADMIN") {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
          <Lock className="w-12 h-12 text-amber-400 mx-auto" />
          <h1 className="text-xl font-black text-white">KOMESTIBLE en Mantenimiento</h1>
          <p className="text-xs text-slate-400">
            El administrador ha pausado temporalmente la sección KOMESTIBLE. Vuelve pronto o explora el catálogo principal de Creadoras.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold"
          >
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl space-y-6">
      {/* CABECERA PRINCIPAL KOMESTIBLE */}
      <div className="bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/40 border border-rose-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                Sección 100% Gratuita
              </span>
              {pendingAdmirersCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black animate-pulse">
                  🔥 A {pendingAdmirersCount} {pendingAdmirersCount === 1 ? "persona le gustaste" : "personas les gustaste"}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <Flame className="w-7 h-7 text-rose-500 fill-rose-500" />
              KOMESTIBLE
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Sube tus fotos para que sean valoradas, desliza tarjetas estilo encuentros y haz match en{" "}
              <Link href="/koinciden" className="text-rose-400 font-bold hover:underline">
                KOINCIDEN
              </Link>
              .
            </p>
          </div>

          {/* Indicador de Likes y acceso a KOINCIDEN */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`px-3.5 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                quota.isLimited
                  ? quota.remaining === 0
                    ? "bg-red-950/60 border-red-500/40 text-red-300"
                    : "bg-slate-950/80 border-rose-500/40 text-rose-300"
                  : "bg-slate-950/80 border-emerald-500/40 text-emerald-300"
              }`}
            >
              <Heart className="w-4 h-4 fill-current shrink-0" />
              {quota.isLimited ? (
                <span>
                  Likes:{" "}
                  <strong className="text-white">
                    {quota.remaining} / {quota.limit}
                  </strong>{" "}
                  <span className="text-[10px] opacity-80">
                    ({quota.period === "DAILY" ? "hoy" : quota.period === "WEEKLY" ? "semana" : "total"})
                  </span>
                </span>
              ) : (
                <span>Likes Ilimitados</span>
              )}
            </div>

            <Link
              href="/koinciden"
              className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition"
            >
              <MessageCircleHeart className="w-4 h-4" />
              <span>KOINCIDEN ({matchesCount})</span>
            </Link>
          </div>
        </div>

        {/* Pestañas internas */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("discover")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "discover"
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                : "bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Descubrir y Valorar
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("myphotos")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "myphotos"
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                : "bg-slate-950/70 text-slate-300 hover:text-white border border-slate-800"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Mis Fotos y Valoración ({myPhotos.length}/{config.maxPhotosPerUser})
          </button>
        </div>
      </div>

      {/* ONBOARDING RÁPIDO SI EL USUARIO NO TIENE GÉNERO REGISTRADO */}
      {needsIdentity && (
        <form
          onSubmit={handleSaveIdentity}
          className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-xl space-y-4"
        >
          <div className="flex items-center gap-2 text-amber-300 text-sm font-black">
            <UserCheck className="w-5 h-5" />
            Completa tu perfil antes de empezar en KOMESTIBLE
          </div>
          <p className="text-xs text-slate-400">
            Indica cómo te identificas y tu país para mostrar tu tarjeta correctamente y aplicar las reglas de interacción.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Me identifico como
              </label>
              <select
                value={idGender}
                onChange={(e) => setIdGender(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white"
              >
                {USER_GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                País
              </label>
              <select
                value={idCountry}
                onChange={(e) => setIdCountry(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingIdentity}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition"
          >
            {savingIdentity ? "Guardando..." : "Guardar y Entrar a KOMESTIBLE"}
          </button>
        </form>
      )}

      {/* PESTAÑA 1: SWIPE CARD STACK */}
      {!needsIdentity && activeTab === "discover" && (
        <div className="space-y-5">
          {/* Barra de Filtros */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Filter className="w-4 h-4 text-rose-400" />
              <span>Filtrar Discovery Deck:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={genderFilter}
                onChange={(e) => applyFilters(e.target.value, countryFilter)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-rose-500 focus:outline-hidden"
              >
                <option value="ALL">Todos los géneros</option>
                {USER_GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.plural}
                  </option>
                ))}
              </select>

              <select
                value={countryFilter}
                onChange={(e) => applyFilters(genderFilter, e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:border-rose-500 focus:outline-hidden"
              >
                <option value="ALL">Todos los países</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Banner recordatorio si el usuario aún no ha subido fotos */}
          {myPhotos.length === 0 && (
            <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-amber-200">
                <strong>¡Aún no apareces en KOMESTIBLE!</strong> Sube al menos una foto gratis para que otros usuarios te valoren y puedas hacer KOINCIDEN.
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("myphotos")}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shrink-0 transition"
              >
                Subir mi primera foto
              </button>
            </div>
          )}

          {loadingDeck ? (
            <div className="py-20 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
              <span>Cargando perfiles en KOMESTIBLE...</span>
            </div>
          ) : (
            <KomestibleSwipeDeck
              initialCards={deck}
              initialQuota={quota}
              onQuotaChange={(q) => setQuota(q)}
              onMatchCreated={() => setMatchesCount((c) => c + 1)}
            />
          )}
        </div>
      )}

      {/* PESTAÑA 2: MIS FOTOS, VALORACIONES Y CONVERSIÓN A CREADORA */}
      {!needsIdentity && activeTab === "myphotos" && (
        <div className="space-y-6">
          {/* Estadísticas + Puente para perfilarse como Creadora de Contenido */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-xl font-black text-rose-400 block">{totalMyLikes}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Likes ❤️</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-xl font-black text-amber-400 block">{avgMyScore}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Nota 🔥</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                <span className="text-xl font-black text-emerald-400 block">{matchesCount}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Koinciden</span>
              </div>
            </div>

            <div className="lg:col-span-7 bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/30 border border-rose-500/40 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {currentUser.role === "CREATOR" ? (
                <>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      Creadora Activa en KONTENIDO
                    </span>
                    <h3 className="text-sm font-black text-white mt-0.5">
                      Tus tarjetas en KOMESTIBLE dirigen fans a tu perfil de pago
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Gestiona tus publicaciones exclusivas y ganancias en tu Estudio de Creadora.
                    </p>
                  </div>
                  <Link
                    href="/panel"
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shrink-0 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    Ir a Mi Estudio
                  </Link>
                </>
              ) : currentUser.role === "CONSUMER" ? (
                <>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" /> Monetiza tu Popularidad
                    </span>
                    <h3 className="text-sm font-black text-white mt-0.5">
                      ¿Quieres generar dinero como Creadora de Contenido?
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Convierte tu cuenta para ofrecer suscripciones en KOIN, contenido exclusivo PPV, chat pago y retiros en USDT o Bolívares.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={promoting}
                    onClick={handlePromoteToCreator}
                    className="px-4 py-3 bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-xs rounded-xl shrink-0 flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {promoting ? "Activando..." : "Perfilarme como Creadora"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <div className="text-xs text-slate-300">
                  Participando en KOMESTIBLE como <strong className="text-white">@{currentUser.username}</strong>.
                </div>
              )}
            </div>
          </div>

          {/* Subir nueva foto */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-rose-500" />
              Subir Foto Gratuita a KOMESTIBLE ({myPhotos.length}/{config.maxPhotosPerUser})
            </h3>

            {uploadError && (
              <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Descripción corta o frase para tu foto (Opcional)
              </label>
              <input
                type="text"
                maxLength={140}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="ej: ¿Qué tal este outfit? ✨"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                  uploading || myPhotos.length >= config.maxPhotosPerUser
                    ? "bg-slate-800 text-slate-500 pointer-events-none"
                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30"
                }`}
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Subiendo foto..." : "Seleccionar de Galería"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading || myPhotos.length >= config.maxPhotosPerUser}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePhotoUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                type="button"
                disabled={uploading || myPhotos.length >= config.maxPhotosPerUser}
                onClick={() => setShowCameraModal(true)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Tomar Foto con Cámara
              </button>
            </div>
          </div>

          {/* Galería de mis fotos subidas y sus valoraciones */}
          {myPhotos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {myPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg flex flex-col"
                >
                  <div className="h-72 bg-slate-950 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/media/${photo.mediaKey}`}
                      alt={photo.caption || "Mi foto en KOMESTIBLE"}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      {photo.status === "APPROVED" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/80 text-white backdrop-blur-xs">
                          Publicada
                        </span>
                      )}
                      {photo.status === "PENDING" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-slate-950">
                          En Revisión
                        </span>
                      )}
                      {photo.status === "REJECTED" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                          Rechazada
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-red-600 text-white transition"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    {photo.caption && (
                      <p className="text-xs text-slate-300 line-clamp-2">{photo.caption}</p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <span className="font-bold text-rose-400 flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 fill-rose-500" />
                        {photo.likesReceived} Likes
                      </span>
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 fill-amber-400" />
                        {photo.avgRating > 0 ? `${photo.avgRating.toFixed(1)}/5` : "Sin notas"} ({photo.ratingCount})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-3xl text-xs text-slate-400">
              Aún no has subido fotos a KOMESTIBLE. ¡Sube tu primera foto arriba para comenzar a recibir valoraciones y likes!
            </div>
          )}
        </div>
      )}

      {showCameraModal && (
        <MediaCaptureModal
          mode="photo"
          defaultFacingMode="user"
          title="Tomar foto para KOMESTIBLE"
          onCapture={(file) => {
            setShowCameraModal(false);
            handlePhotoUpload(file);
          }}
          onClose={() => setShowCameraModal(false)}
        />
      )}
    </div>
  );
}
