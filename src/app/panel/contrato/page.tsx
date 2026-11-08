"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck, Shield, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { signContractAction } from "@/actions/kyc";

/**
 * Pantalla de Firma Digital del Contrato Virtual de Creador
 * Texto íntegro según 08_CONTRATOS_Y_LEGAL.md
 */
export default function ContratoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await signContractAction(formData);
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/panel/pagos");
      }, 1500);
    } catch (err) {
      setError("Error registrando la firma del contrato.");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Contrato Virtual Obligatorio</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Acuerdo de términos de prestación de servicios para creadores de KONTENIDO.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Contrato firmado exitosamente. Redirigiendo a configuración de métodos de cobro...</span>
          </div>
        )}

        {/* Caja de texto del contrato con scroll */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 leading-relaxed max-h-72 overflow-y-auto mb-6 space-y-3 font-mono">
          <h3 className="font-bold text-white text-sm uppercase text-center border-b border-slate-800 pb-2">
            CONTRATO DE PRESTACIÓN DE SERVICIOS – KONTENIDO
          </h3>
          <p>
            Por medio del presente instrumento virtual, el creador que suscribe declara:
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>Ser MAYOR DE EDAD (≥ 18 años)</strong>, lo cual fue validado mediante mi cédula venezolana y registro biométrico/selfie.
            </li>
            <li>
              Que todo el contenido (fotografías y videos) que publique en KONTENIDO es creado por mi voluntad propia, sin coacción, y es de mi autoría o cuento con todos los derechos correspondientes.
            </li>
            <li>
              Que libero a KONTENIDO (la plataforma) de cualquier obligación, relación laboral, de creación de contenido o responsabilidad sobre el material publicado. KONTENIDO es únicamente un canal tecnológico de oferta y no produce, edita ni distribuye contenido propio.
            </li>
            <li>
              Que cumplo con la legislación venezolana aplicable y me hago estrictamente responsable del contenido que publico.
            </li>
            <li>
              Que entiendo que los pagos se realizan vía cortes semanales en los métodos configurados (Banco, PagoMóvil o Binance) y que la plataforma retiene una comisión de intermediación de la tarifa configurada.
            </li>
            <li>
              Que acepto la política de moderación y entiendo que mi cuenta puede ser suspendida si incumplo con los lineamientos de seguridad.
            </li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre y Apellido (Firma declarativa)
              </label>
              <input
                name="fullName"
                type="text"
                required
                placeholder="Tu nombre completo"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cédula de Identidad
              </label>
              <input
                name="idDocument"
                type="text"
                required
                placeholder="ej: V-25123456"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-white text-sm focus:border-rose-500 focus:outline-hidden transition"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-start gap-2.5 mt-2">
            <input
              type="checkbox"
              name="accepted"
              id="accepted"
              required
              className="mt-0.5 rounded border-slate-700 bg-slate-900 text-rose-600 focus:ring-rose-500"
            />
            <label htmlFor="accepted" className="text-xs text-slate-300 leading-snug">
              He leído y acepto los términos del Contrato de Prestación de Servicios de KONTENIDO. Entiendo que esta firma digital queda registrada con mi dirección IP y fecha para efectos legales.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-lg shadow-rose-600/30 disabled:opacity-50 mt-4"
          >
            {loading ? "Firmando contrato..." : "Firmar Contrato y Configurar Pagos"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
