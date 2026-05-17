import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import FlowLayout from '../../components/FlowLayout';
import { API_URL } from '../../config/api';
import toast from 'react-hot-toast';
import {
  UserCircleIcon,
  IdentificationIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Profile {
  id: number;
  email: string;
  role: string;
  full_name: string | null;
  professional_title: string | null;
  license_number: string | null;
  signature_image: string | null;
}

export default function EvaluatorProfile() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);

  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [license, setLicense] = useState('');
  const [sigPreview, setSigPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No autorizado');
      const data: Profile = await res.json();
      setProfile(data);
      setFullName(data.full_name || '');
      setTitle(data.professional_title || '');
      setLicense(data.license_number || '');
      setSigPreview(data.signature_image || null);
    } catch {
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName,
          professional_title: title,
          license_number: license,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Perfil actualizado exitosamente');
    } catch {
      toast.error('Error al guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen (PNG, JPG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const original = ev.target?.result as string;
      // Resize to max 500x150 to keep base64 small
      const img = new Image();
      img.onload = () => {
        const maxW = 500;
        const maxH = 150;
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resized = canvas.toDataURL('image/png');
        setSigPreview(resized);
        uploadSignature(resized);
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  };

  const uploadSignature = async (base64: string) => {
    setUploadingSig(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/profile/signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ signature_image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      toast.success('Firma guardada exitosamente');
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar la firma');
      setSigPreview(profile?.signature_image || null);
    } finally {
      setUploadingSig(false);
    }
  };

  const handleDeleteSignature = async () => {
    if (!confirm('¿Eliminar la firma digital?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/auth/profile/signature`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setSigPreview(null);
      toast.success('Firma eliminada');
    } catch {
      toast.error('Error al eliminar la firma');
    }
  };

  if (loading) {
    return (
      <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menú" maxWidth="full">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </FlowLayout>
    );
  }

  return (
    <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menú" maxWidth="full">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <UserCircleIcon className="h-8 w-8 text-blue-600 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
            <p className="text-sm text-gray-500">{profile?.email}</p>
          </div>
        </div>

        {/* Datos profesionales */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <IdentificationIcon className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-800">Datos profesionales</h2>
          </div>
          <p className="text-xs text-gray-500">
            Estos datos aparecerán en la portada y en la firma de los informes PDF que generes.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: María Fernanda López Gómez"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título profesional
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Psicóloga Especialista en Salud Ocupacional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de tarjeta profesional
              </label>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                placeholder="Ej: 123456-P"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">
                Se mostrará como «T.P. No. {license || '...'}» en el informe.
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <CheckCircleIcon className="h-4 w-4" />
            )}
            {saving ? 'Guardando…' : 'Guardar datos'}
          </button>
        </div>

        {/* Firma digital */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <PencilSquareIcon className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-800">Firma digital</h2>
          </div>
          <p className="text-xs text-gray-500">
            Sube una imagen de tu firma (PNG o JPG, fondo blanco recomendado). Aparecerá en la sección
            de conclusiones de los informes organizacionales e individuales.
          </p>

          {sigPreview ? (
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-center justify-center min-h-[100px]">
                {uploadingSig ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
                    Guardando firma…
                  </div>
                ) : (
                  <img
                    src={sigPreview}
                    alt="Firma digital"
                    className="max-h-24 max-w-xs object-contain"
                  />
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Reemplazar
                </button>
                <button
                  onClick={handleDeleteSignature}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                  Eliminar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl py-8 gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors cursor-pointer"
            >
              <ArrowUpTrayIcon className="h-8 w-8" />
              <span className="text-sm font-medium">Subir firma</span>
              <span className="text-xs">PNG, JPG — máximo 500 KB</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleSignatureFile}
          />
        </div>

        {/* Preview del pie de página del informe */}
        {(fullName || title || license || sigPreview) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <h2 className="text-base font-semibold text-gray-800">Vista previa en el informe</h2>
            <p className="text-xs text-gray-500">
              Así se verá la sección de firma al final de tus informes PDF.
            </p>
            <div className="border border-gray-100 rounded-xl bg-gray-50 py-6 flex flex-col items-center gap-1">
              <div className="w-40 border-t border-gray-300 mb-2" />
              {sigPreview && (
                <img
                  src={sigPreview}
                  alt="Firma preview"
                  className="max-h-16 max-w-[160px] object-contain mb-1"
                />
              )}
              <p className="text-sm font-semibold text-gray-800">
                {fullName || 'Nombre del evaluador'}
              </p>
              <p className="text-xs text-gray-500">
                {title || 'Título profesional'}
              </p>
              {license && (
                <p className="text-xs text-gray-500">T.P. No. {license}</p>
              )}
            </div>
          </div>
        )}

      </div>
    </FlowLayout>
  );
}
