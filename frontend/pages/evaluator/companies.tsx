import { useState, useEffect } from 'react';
import FlowLayout from '../../components/FlowLayout';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Company {
  id: number;
  name: string;
  nit: string;
  contact_email: string;
  contact_phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string | null;
}

export default function EvaluatorCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nit: '',
    contact_email: '',
    contact_phone: ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/companies/mine', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies);
      } else {
        toast.error('Error al cargar empresas');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const url = editingCompany
        ? `/api/companies/${editingCompany.id}`
        : '/api/companies';
      const method = editingCompany ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(
          editingCompany
            ? 'Empresa actualizada exitosamente'
            : 'Empresa creada exitosamente'
        );
        setShowModal(false);
        setEditingCompany(null);
        setFormData({ name: '', nit: '', contact_email: '', contact_phone: '' });
        fetchCompanies();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error al guardar empresa');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexion');
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      nit: company.nit,
      contact_email: company.contact_email,
      contact_phone: company.contact_phone || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Estas seguro de que quieres eliminar esta empresa?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/companies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchCompanies();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error al eliminar empresa');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexion');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </FlowLayout>
    );
  }

  return (
    <FlowLayout backHref="/evaluator/dashboard" backLabel="Volver al menu" maxWidth="full">
      <div className="space-y-6">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Empresas</h1>
            <p className="mt-2 text-sm text-gray-600">
              Gestiona las empresas a las que les aplicas baterias de riesgo psicosocial
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => {
                setEditingCompany(null);
                setFormData({ name: '', nit: '', contact_email: '', contact_phone: '' });
                setShowModal(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Nueva Empresa
            </button>
          </div>
        </div>

        {/* Companies List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {companies.length === 0 ? (
            <div className="text-center py-12">
              <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No hay empresas
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza creando tu primera empresa para aplicar baterias.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => {
                    setEditingCompany(null);
                    setFormData({ name: '', nit: '', contact_email: '', contact_phone: '' });
                    setShowModal(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Nueva Empresa
                </button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {companies.map((company) => (
                <li key={company.id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-100">
                          <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {company.name}
                          </div>
                          {!company.active && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Inactiva
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          NIT: {company.nit}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {company.contact_email}
                          {company.contact_phone && ` | ${company.contact_phone}`}
                          {' | '}Creada {formatDate(company.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(company)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Editar"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(company.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="Eliminar"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 text-center mb-4">
                {editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre de la Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="FOUNDEVER S.A.S"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    NIT *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nit}
                    onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="900123456-7"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email de Contacto *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="contacto@empresa.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Telefono
                  </label>
                  <input
                    type="text"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="(601) 123-4567"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingCompany(null);
                      setFormData({ name: '', nit: '', contact_email: '', contact_phone: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {editingCompany ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </FlowLayout>
  );
}
