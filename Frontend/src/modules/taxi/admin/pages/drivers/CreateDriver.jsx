import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  ChevronRight,
  FileText,
  ImagePlus,
  Loader2,
  ShieldCheck,
  UploadCloud,
  User,
  Car,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTaxiTransportTypes } from '../../../../shared/hooks/useTaxiTransportTypes';
import { normalizeDriverDocumentTemplates } from '../../../driver/utils/documentTemplates';
import { adminService } from '../../services/adminService';

const NAME_REGEX = /^[A-Za-z]+(?:[ .'-][A-Za-z]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VEHICLE_NUMBER_REGEX = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;

const inputClass =
  'w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors placeholder:text-gray-400';
const selectClass = `${inputClass} appearance-none`;
const cardClass = 'bg-white rounded-xl border border-gray-200 p-6 shadow-sm';
const labelClass = 'block text-xs font-semibold text-gray-500 mb-1.5';

const defaultVehicleFieldConfigs = [
  { field_key: 'locationId', name: 'Operating City', account_type: 'both', is_required: true, active: true, sort_order: 10, placeholder: '' },
  { field_key: 'serviceCategories', name: 'Service Category', account_type: 'individual', is_required: true, active: true, sort_order: 20, placeholder: '' },
  { field_key: 'vehicleTypeId', name: 'Vehicle Type', account_type: 'individual', is_required: true, active: true, sort_order: 30, placeholder: '' },
  { field_key: 'make', name: 'Brand / Make', account_type: 'individual', is_required: true, active: true, sort_order: 40, placeholder: 'e.g. Maruti Suzuki' },
  { field_key: 'model', name: 'Model', account_type: 'individual', is_required: true, active: true, sort_order: 50, placeholder: 'Swift, Bolt' },
  { field_key: 'year', name: 'Year', account_type: 'individual', is_required: true, active: true, sort_order: 60, placeholder: String(new Date().getFullYear()) },
  { field_key: 'number', name: 'Plate Number', account_type: 'individual', is_required: true, active: true, sort_order: 70, placeholder: 'DL1RT1234' },
  { field_key: 'color', name: 'Exterior Color', account_type: 'individual', is_required: true, active: true, sort_order: 80, placeholder: 'e.g. White, Black' },
];

const normalizeVehicleOptions = (payload) => {
  const results = Array.isArray(payload)
    ? payload
    : payload?.results || payload?.data?.results || payload?.data || [];

  return (Array.isArray(results) ? results : [])
    .map((item) => ({
      id: String(item?._id || item?.id || ''),
      value: String(item?.vehicle_type || item?.name || item?.slug || item?._id || '').toLowerCase(),
      label: item?.vehicle_type || item?.name || 'Vehicle',
      transportType: String(item?.transport_type || '').toLowerCase(),
      raw: item,
    }))
    .filter((item) => item.id);
};

const matchesVehicleFieldAccountType = (accountType) => {
  const normalized = String(accountType || 'individual').trim().toLowerCase();
  return ['both', 'individual'].includes(normalized);
};

const matchesDocumentRole = (accountType) => {
  const normalized = String(accountType || 'individual').trim().toLowerCase();
  return ['both', 'individual'].includes(normalized);
};

const normalizeVehicleNumber = (value = '') =>
  String(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 11);

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const normalizeDocument = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return {
      previewUrl: value,
      secureUrl: value,
      uploaded: true,
    };
  }

  return {
    ...value,
    previewUrl: value.previewUrl || value.secureUrl || value.url || '',
    secureUrl: value.secureUrl || value.previewUrl || value.url || '',
    uploaded: value.uploaded ?? Boolean(value.previewUrl || value.secureUrl || value.url),
    identifyNumber: String(value.identifyNumber || value.identify_number || '').trim(),
    expiryDate: String(value.expiryDate || value.expiry_date || '').trim(),
  };
};

const buildTemplateMetaState = (templates = [], documents = {}) =>
  Object.fromEntries(
    templates.map((template) => {
      const firstDocument = (template.fields || [])
        .map((field) => normalizeDocument(documents[field.key]))
        .find(Boolean);

      return [
        template.id,
        {
          identifyNumber: String(firstDocument?.identifyNumber || '').trim(),
          expiryDate: String(firstDocument?.expiryDate || '').trim(),
        },
      ];
    }),
  );

const typeLabel = (value = '') =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const extractResults = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.data?.results)) {
    return payload.data.results;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

const serviceCategoryChoices = [
  { id: 'taxi', label: 'Taxi' },
  { id: 'outstation', label: 'Outstation' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'pooling', label: 'Pooling' },
];

const initialFormData = {
  service_location_id: '',
  name: '',
  mobile: '',
  gender: '',
  email: '',
  password: '',
  password_confirmation: '',
  transport_type: 'taxi',
  service_categories: ['taxi'],
  vehicle_type_id: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_year: '',
  vehicle_color: '',
  vehicle_number: '',
  country: '',
  profile_picture: '',
  customFields: {},
};

const CreateDriver = () => {
  const navigate = useNavigate();
  const { transportTypes } = useTaxiTransportTypes();

  const [formData, setFormData] = useState(initialFormData);
  const [areas, setAreas] = useState([]);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [vehicleFieldConfigs, setVehicleFieldConfigs] = useState(defaultVehicleFieldConfigs);
  const [documentTemplates, setDocumentTemplates] = useState([]);
  const [documents, setDocuments] = useState({});
  const [documentMeta, setDocumentMeta] = useState({});
  const [profileName, setProfileName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [uploadingDocKey, setUploadingDocKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBootstrap = async () => {
      setIsLoading(true);
      setError('');

      try {
        const [locationsResponse, vehicleFieldResponse, documentResponse] = await Promise.all([
          adminService.getServiceLocations(),
          adminService.getDriverNeededDocuments('vehicle_field'),
          adminService.getDriverNeededDocuments('document'),
        ]);

        const nextAreas = extractResults(locationsResponse);
        const nextVehicleFields = extractResults(vehicleFieldResponse);
        const nextTemplates = extractResults(documentResponse);

        setAreas(Array.isArray(nextAreas) ? nextAreas : []);
        setVehicleFieldConfigs(
          Array.isArray(nextVehicleFields) && nextVehicleFields.length > 0
            ? nextVehicleFields
            : defaultVehicleFieldConfigs,
        );
        setDocumentTemplates(normalizeDriverDocumentTemplates(nextTemplates));
      } catch (apiError) {
        setError(apiError?.message || 'Unable to load driver onboarding form');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBootstrap();
  }, []);

  useEffect(() => {
    const fetchVehicleTypes = async () => {
      if (!formData.service_location_id || !formData.transport_type) {
        setVehicleTypes([]);
        setFormData((current) => ({
          ...current,
          vehicle_type_id: '',
        }));
        return;
      }

      setIsLoadingVehicles(true);

      try {
        let options = [];

        try {
          const locationResponse = await adminService.getLocationVehicleTypes(
            formData.service_location_id,
            formData.transport_type,
          );
          options = normalizeVehicleOptions(locationResponse);
        } catch {
          options = [];
        }

        if (options.length === 0) {
          const catalogResponse = await adminService.getVehicleTypes(
            formData.transport_type === 'both' ? undefined : formData.transport_type,
          );
          options = normalizeVehicleOptions(catalogResponse).filter((item) => {
            if (!item.transportType) return true;
            if (formData.transport_type === 'both') {
              return ['taxi', 'delivery', 'both'].includes(item.transportType);
            }
            return item.transportType === formData.transport_type || item.transportType === 'both';
          });
        }

        setVehicleTypes(options);
        setFormData((current) => {
          if (options.some((item) => item.id === current.vehicle_type_id)) {
            return current;
          }
          return {
            ...current,
            vehicle_type_id: '',
          };
        });
      } catch (apiError) {
        setVehicleTypes([]);
        setError(apiError?.message || 'Unable to load vehicle types');
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    fetchVehicleTypes();
  }, [formData.service_location_id, formData.transport_type]);

  const visibleVehicleFields = useMemo(
    () =>
      [...vehicleFieldConfigs]
        .filter((item) => item?.active !== false && matchesVehicleFieldAccountType(item?.account_type))
        .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0)),
    [vehicleFieldConfigs],
  );

  const fieldConfigMap = useMemo(
    () =>
      visibleVehicleFields.reduce((acc, item) => {
        acc[String(item.field_key || '').trim()] = item;
        return acc;
      }, {}),
    [visibleVehicleFields],
  );

  const builtInVehicleFieldKeys = new Set([
    'locationId',
    'serviceCategories',
    'vehicleTypeId',
    'make',
    'model',
    'year',
    'number',
    'color',
  ]);

  const customVehicleFields = useMemo(
    () =>
      visibleVehicleFields.filter((item) => !builtInVehicleFieldKeys.has(String(item.field_key || '').trim())),
    [visibleVehicleFields],
  );

  const visibleDocumentTemplates = useMemo(
    () => documentTemplates.filter((item) => matchesDocumentRole(item.account_type)),
    [documentTemplates],
  );

  useEffect(() => {
    setDocumentMeta((current) => ({
      ...buildTemplateMetaState(visibleDocumentTemplates, documents),
      ...current,
    }));
  }, [documents, visibleDocumentTemplates]);

  const selectedArea = useMemo(
    () => areas.find((area) => String(area._id) === String(formData.service_location_id)) || null,
    [areas, formData.service_location_id],
  );

  const selectedVehicle = useMemo(
    () => vehicleTypes.find((item) => item.id === formData.vehicle_type_id) || null,
    [vehicleTypes, formData.vehicle_type_id],
  );

  const setField = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const getFieldConfig = (key, fallback = {}) => ({
    name: fallback.name || '',
    placeholder: fallback.placeholder || '',
    help_text: fallback.help_text || '',
    is_required: fallback.is_required ?? true,
    ...fieldConfigMap[key],
  });

  const shouldShowField = (key, fallback = true) => {
    if (!fieldConfigMap[key]) return fallback;
    return fieldConfigMap[key].active !== false;
  };

  const isFieldRequired = (key, fallback = true) => {
    if (!fieldConfigMap[key]) return fallback;
    return fieldConfigMap[key].is_required !== false;
  };

  const handleAreaChange = (event) => {
    const areaId = event.target.value;
    const area = areas.find((item) => String(item._id) === String(areaId));

    setFormData((current) => ({
      ...current,
      service_location_id: areaId,
      country: area?.country?._id || area?.country || current.country,
    }));
  };

  const handleTransportChange = (event) => {
    const nextTransportType = event.target.value;
    setFormData((current) => ({
      ...current,
      transport_type: nextTransportType,
      vehicle_type_id: '',
      service_categories:
        nextTransportType === 'both'
          ? ['taxi', 'outstation']
          : [nextTransportType === 'delivery' ? 'delivery' : nextTransportType === 'pooling' ? 'pooling' : 'taxi'],
    }));
  };

  const toggleServiceCategory = (categoryId) => {
    setFormData((current) => {
      const exists = current.service_categories.includes(categoryId);
      const nextValues = exists
        ? current.service_categories.filter((item) => item !== categoryId)
        : [...current.service_categories, categoryId];

      return {
        ...current,
        service_categories: nextValues,
      };
    });
  };

  const handleProfileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProfileName(file.name);

    try {
      const dataUrl = await fileToDataUrl(file);
      setField('profile_picture', dataUrl);
    } catch {
      setError('Unable to read profile image');
    }
  };

  const handleCustomFieldChange = (fieldKey, value) => {
    setFormData((current) => ({
      ...current,
      customFields: {
        ...(current.customFields || {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleMetaChange = (templateId, fieldName, nextValue) => {
    setDocumentMeta((current) => ({
      ...current,
      [templateId]: {
        ...(current[templateId] || {}),
        [fieldName]: nextValue,
      },
    }));
  };

  const applyTemplateMetaToDocuments = (templateId, templateDocuments, metaOverride = null) => {
    const meta = metaOverride || documentMeta[templateId] || { identifyNumber: '', expiryDate: '' };
    const identifyNumber = String(meta.identifyNumber || '').trim();
    const expiryDate = String(meta.expiryDate || '').trim();

    return Object.fromEntries(
      Object.entries(templateDocuments).map(([docKey, docValue]) => [
        docKey,
        docValue
          ? {
              ...docValue,
              identifyNumber,
              identify_number: identifyNumber,
              expiryDate,
              expiry_date: expiryDate,
            }
          : docValue,
      ]),
    );
  };

  const handleDocumentFileChange = async (templateId, fieldKey, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setUploadingDocKey(fieldKey);
    setError('');

    try {
      const dataUrl = await fileToDataUrl(file);
      const nextDocument = applyTemplateMetaToDocuments(
        templateId,
        {
          [fieldKey]: {
            previewUrl: dataUrl,
            secureUrl: dataUrl,
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
            uploaded: true,
          },
        },
      )[fieldKey];

      setDocuments((current) => ({
        ...current,
        [fieldKey]: nextDocument,
      }));
    } catch {
      setError('Unable to read document image');
    } finally {
      setUploadingDocKey('');
    }
  };

  const validateForm = () => {
    const fullName = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const phone = String(formData.mobile || '').replace(/\D/g, '');
    const currentYear = new Date().getFullYear();
    const vehicleYear = Number(formData.vehicle_year || 0);

    if (!fullName || !NAME_REGEX.test(fullName)) {
      return 'Please enter a valid driver name';
    }

    if (!EMAIL_REGEX.test(email)) {
      return 'Please enter a valid email address';
    }

    if (!/^\d{10}$/.test(phone)) {
      return 'Please enter a valid 10-digit mobile number';
    }

    if (!formData.gender) {
      return 'Please select gender';
    }

    if (!formData.password || formData.password.length < 6) {
      return 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.password_confirmation) {
      return 'Password and confirm password must match';
    }

    if (!formData.service_location_id) {
      return 'Please select area';
    }

    if (isFieldRequired('serviceCategories', true) && formData.service_categories.length === 0) {
      return 'Please select at least one service category';
    }

    if (!formData.vehicle_type_id) {
      return 'Please select vehicle type';
    }

    if (!String(formData.vehicle_make || '').trim()) {
      return 'Please enter vehicle make';
    }

    if (!String(formData.vehicle_model || '').trim()) {
      return 'Please enter vehicle model';
    }

    if (!/^\d{4}$/.test(String(formData.vehicle_year || '')) || vehicleYear < 1980 || vehicleYear > currentYear) {
      return `Vehicle year must be between 1980 and ${currentYear}`;
    }

    if (!VEHICLE_NUMBER_REGEX.test(normalizeVehicleNumber(formData.vehicle_number))) {
      return 'Vehicle number must be in valid Indian format';
    }

    if (!String(formData.vehicle_color || '').trim()) {
      return 'Please enter vehicle color';
    }

    const missingCustomField = customVehicleFields.find(
      (field) =>
        field?.is_required !== false &&
        !String(
          Array.isArray(formData.customFields?.[field.field_key])
            ? formData.customFields?.[field.field_key]?.join(',')
            : formData.customFields?.[field.field_key] || '',
        ).trim(),
    );

    if (missingCustomField) {
      return `${missingCustomField.name || 'Additional field'} is required`;
    }

    for (const template of visibleDocumentTemplates) {
      const fields = Array.isArray(template.fields) ? template.fields : [];
      const requiredFields = fields.filter((field) => Boolean(field.required ?? template.is_required));
      const meta = documentMeta[template.id] || {};

      if (requiredFields.some((field) => !documents[field.key]?.uploaded && !documents[field.key]?.secureUrl)) {
        return `Please upload ${template.name}`;
      }

      if (template.has_identify_number && requiredFields.length > 0 && !String(meta.identifyNumber || '').trim()) {
        return `${template.name} number is required`;
      }

      if (template.has_expiry_date && requiredFields.length > 0 && !String(meta.expiryDate || '').trim()) {
        return `${template.name} expiry date is required`;
      }
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payloadDocuments = { ...documents };

      for (const template of visibleDocumentTemplates) {
        const templateFields = Array.isArray(template.fields) ? template.fields : [];
        const templateDocuments = Object.fromEntries(
          templateFields
            .filter((field) => payloadDocuments[field.key])
            .map((field) => [field.key, payloadDocuments[field.key]]),
        );

        Object.assign(
          payloadDocuments,
          applyTemplateMetaToDocuments(template.id, templateDocuments),
        );
      }

      const response = await adminService.createDriver({
        name: formData.name.trim(),
        mobile: String(formData.mobile || '').replace(/\D/g, ''),
        phone: String(formData.mobile || '').replace(/\D/g, ''),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        password_confirmation: formData.password_confirmation,
        gender: formData.gender.toLowerCase(),
        service_location_id: formData.service_location_id,
        country: formData.country,
        profile_picture: formData.profile_picture,
        transport_type: formData.transport_type,
        serviceCategories: formData.service_categories,
        vehicle_type_id: formData.vehicle_type_id,
        vehicle_type: selectedVehicle?.label || '',
        vehicle_make: formData.vehicle_make.trim(),
        vehicle_model: formData.vehicle_model.trim(),
        vehicle_color: formData.vehicle_color.trim(),
        vehicle_number: normalizeVehicleNumber(formData.vehicle_number),
        approve: true,
        status: 'approved',
        documents: payloadDocuments,
        onboarding: {
          role: 'driver',
          customFields: formData.customFields,
          vehicleYear: String(formData.vehicle_year || '').trim(),
          createdFromAdminOnboarding: true,
          serviceLocationName: selectedArea?.service_location_name || selectedArea?.name || '',
        },
      });

      if (response?.success) {
        navigate('/admin/drivers');
        return;
      }

      setError(response?.message || 'Failed to create driver');
    } catch (apiError) {
      setError(apiError?.message || 'Failed to create driver');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-gray-500">Preparing onboarding form...</p>
        </div>
      </div>
    );
  }

  const locationField = getFieldConfig('locationId', { name: 'Operating City' });
  const serviceCategoryField = getFieldConfig('serviceCategories', { name: 'Service Category' });
  const vehicleTypeField = getFieldConfig('vehicleTypeId', { name: 'Vehicle Type' });
  const makeField = getFieldConfig('make', { name: 'Brand / Make', placeholder: 'e.g. Maruti Suzuki' });
  const modelField = getFieldConfig('model', { name: 'Model', placeholder: 'Swift, Bolt' });
  const yearField = getFieldConfig('year', { name: 'Year', placeholder: String(new Date().getFullYear()) });
  const numberField = getFieldConfig('number', { name: 'Plate Number', placeholder: 'DL1RT1234' });
  const colorField = getFieldConfig('color', { name: 'Exterior Color', placeholder: 'e.g. White, Black' });

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
              <span>Drivers</span>
              <ChevronRight size={12} />
              <span className="text-gray-700">Admin Onboarding</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Create Driver <span className="text-gray-500 font-normal text-base ml-1">Full Onboarding</span>
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-gray-500">
              Fill personal info, vehicle setup, and required KYC here so the driver shows up ready across the app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/drivers')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Back to Drivers
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {error}
            </div>
          ) : null}

          <section className={cardClass}>
            <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Personal Info</h3>
                <p className="text-xs text-gray-400">Driver identity and login credentials</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  value={formData.name}
                  onChange={(event) => setField('name', event.target.value.replace(/[^A-Za-z .'-]/g, ''))}
                  placeholder="Enter driver name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Mobile Number</label>
                <input
                  value={formData.mobile}
                  onChange={(event) => setField('mobile', event.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10 digit mobile number"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) => setField('email', event.target.value)}
                  placeholder="name@gmail.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <div className="grid grid-cols-3 gap-3">
                  {['male', 'female', 'other'].map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      onClick={() => setField('gender', gender)}
                      className={`rounded-lg border px-4 py-2.5 text-xs font-medium capitalize transition-all ${
                        formData.gender === gender
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(event) => setField('password', event.target.value)}
                  placeholder="Minimum 6 characters"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Confirm Password</label>
                <input
                  type="password"
                  value={formData.password_confirmation}
                  onChange={(event) => setField('password_confirmation', event.target.value)}
                  placeholder="Re-enter password"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-5 max-w-md">
              <label className={labelClass}>Profile Image</label>
              <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center transition-colors hover:border-indigo-300 hover:bg-white">
                {formData.profile_picture ? (
                  <img src={formData.profile_picture} alt="Driver profile" className="h-[160px] w-full rounded-lg object-cover" />
                ) : (
                  <>
                    <Camera size={24} className="mb-2 text-gray-400" />
                    <span className="text-xs font-medium text-gray-600">
                      {profileName || 'Upload Profile Photo'}
                    </span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleProfileChange} className="hidden" />
              </label>
            </div>
          </section>

          <section className={cardClass}>
            <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Car size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Vehicle Setup</h3>
                <p className="text-xs text-gray-400">Transport type, area, and vehicle details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {shouldShowField('locationId', true) ? (
                <div>
                  <label className={labelClass}>{locationField.name}</label>
                  <select value={formData.service_location_id} onChange={handleAreaChange} className={selectClass}>
                    <option value="">Select area</option>
                    {areas.map((area) => (
                      <option key={area._id} value={area._id}>
                        {area.service_location_name || area.name || 'Area'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className={labelClass}>Transport Type</label>
                <select value={formData.transport_type} onChange={handleTransportChange} className={selectClass}>
                  <option value="">Select transport type</option>
                  {transportTypes.map((type) => (
                    <option key={type.id || type._id || type.name} value={type.name}>
                      {type.display_name || type.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {shouldShowField('serviceCategories', true) ? (
              <div className="mt-5">
                <label className={labelClass}>{serviceCategoryField.name}</label>
                <div className="flex flex-wrap gap-2.5">
                  {serviceCategoryChoices.map((item) => {
                    const selected = formData.service_categories.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleServiceCategory(item.id)}
                        className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                          selected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {shouldShowField('vehicleTypeId', true) ? (
                <div>
                  <label className={labelClass}>{vehicleTypeField.name}</label>
                  <select
                    value={formData.vehicle_type_id}
                    onChange={(event) => setField('vehicle_type_id', event.target.value)}
                    className={selectClass}
                    disabled={!formData.service_location_id || isLoadingVehicles}
                  >
                    <option value="">{isLoadingVehicles ? 'Loading...' : 'Select vehicle type'}</option>
                    {vehicleTypes.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {shouldShowField('make', true) ? (
                <div>
                  <label className={labelClass}>{makeField.name}</label>
                  <input
                    value={formData.vehicle_make}
                    onChange={(event) => setField('vehicle_make', event.target.value)}
                    placeholder={makeField.placeholder}
                    className={inputClass}
                  />
                </div>
              ) : null}

              {shouldShowField('model', true) ? (
                <div>
                  <label className={labelClass}>{modelField.name}</label>
                  <input
                    value={formData.vehicle_model}
                    onChange={(event) => setField('vehicle_model', event.target.value)}
                    placeholder={modelField.placeholder}
                    className={inputClass}
                  />
                </div>
              ) : null}

              {shouldShowField('year', true) ? (
                <div>
                  <label className={labelClass}>{yearField.name}</label>
                  <input
                    value={formData.vehicle_year}
                    onChange={(event) => setField('vehicle_year', event.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder={yearField.placeholder}
                    className={inputClass}
                  />
                </div>
              ) : null}

              {shouldShowField('number', true) ? (
                <div>
                  <label className={labelClass}>{numberField.name}</label>
                  <input
                    value={formData.vehicle_number}
                    onChange={(event) => setField('vehicle_number', normalizeVehicleNumber(event.target.value))}
                    placeholder={numberField.placeholder}
                    className={inputClass}
                  />
                </div>
              ) : null}

              {shouldShowField('color', true) ? (
                <div>
                  <label className={labelClass}>{colorField.name}</label>
                  <input
                    value={formData.vehicle_color}
                    onChange={(event) => setField('vehicle_color', event.target.value)}
                    placeholder={colorField.placeholder}
                    className={inputClass}
                  />
                </div>
              ) : null}
            </div>

            {customVehicleFields.length > 0 ? (
              <div className="mt-6 space-y-4 pt-4 border-t border-gray-100">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Additional Fields</h3>
                  <p className="mt-0.5 text-xs text-gray-500">These are configured from admin onboarding settings.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {customVehicleFields.map((field) => {
                    const fieldKey = String(field.field_key || '').trim();
                    const fieldType = String(field.field_type || 'text').trim().toLowerCase();
                    const value = formData.customFields?.[fieldKey] || (fieldType === 'multi_select' ? [] : '');
                    const options = Array.isArray(field.options) ? field.options : [];

                    if (fieldType === 'textarea') {
                      return (
                        <div key={fieldKey} className="md:col-span-2">
                          <label className={labelClass}>{field.name}</label>
                          <textarea
                            value={value}
                            onChange={(event) => handleCustomFieldChange(fieldKey, event.target.value)}
                            placeholder={field.placeholder || ''}
                            rows={4}
                            className={`${inputClass} min-h-[120px] resize-none`}
                          />
                        </div>
                      );
                    }

                    if (fieldType === 'select') {
                      return (
                        <div key={fieldKey}>
                          <label className={labelClass}>{field.name}</label>
                          <select
                            value={value}
                            onChange={(event) => handleCustomFieldChange(fieldKey, event.target.value)}
                            className={selectClass}
                          >
                            <option value="">{field.placeholder || `Select ${field.name}`}</option>
                            {options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (fieldType === 'multi_select') {
                      const selectedValues = Array.isArray(value) ? value : [];
                      return (
                        <div key={fieldKey} className="md:col-span-2">
                          <label className={labelClass}>{field.name}</label>
                          <div className="flex flex-wrap gap-2.5">
                            {options.map((option) => {
                              const selected = selectedValues.includes(option);
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() =>
                                    handleCustomFieldChange(
                                      fieldKey,
                                      selected
                                        ? selectedValues.filter((item) => item !== option)
                                        : [...selectedValues, option],
                                    )
                                  }
                                  className={`rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                                    selected
                                      ? 'bg-indigo-600 text-white shadow-sm'
                                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={fieldKey}>
                        <label className={labelClass}>{field.name}</label>
                        <input
                          type={fieldType === 'number' ? 'tel' : 'text'}
                          value={Array.isArray(value) ? value.join(', ') : value}
                          onChange={(event) =>
                            handleCustomFieldChange(
                              fieldKey,
                              fieldType === 'number'
                                ? event.target.value.replace(/\D/g, '')
                                : event.target.value,
                            )
                          }
                          placeholder={field.placeholder || ''}
                          className={inputClass}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className={cardClass}>
            <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Documents Vault</h3>
                <p className="text-xs text-gray-400">Required KYC and driver verification files</p>
              </div>
            </div>

            <div className="space-y-6">
              {visibleDocumentTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm font-medium text-gray-400">
                  No driver document templates are configured yet.
                </div>
              ) : (
                visibleDocumentTemplates.map((template) => (
                  <div key={template.id} className="rounded-xl border border-gray-200 bg-gray-50/50 p-5">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{template.name}</h3>
                        <p className="mt-0.5 text-xs font-medium text-gray-500">
                          {template.is_required ? 'Required' : 'Optional'} • {typeLabel(template.account_type || 'individual')}
                        </p>
                      </div>
                      <div className="rounded-md bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600 shadow-sm">
                        {template.fields?.length > 1 ? 'Multiple Sides' : 'Single Side'}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {(template.fields || []).map((field) => {
                        const doc = documents[field.key];
                        const isUploading = uploadingDocKey === field.key;

                        return (
                          <div key={field.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="mb-2.5 flex items-center justify-between gap-3">
                              <label className="text-xs font-semibold text-gray-700">{field.label}</label>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                (field.required ?? template.is_required)
                                  ? 'bg-indigo-50 text-indigo-600'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {(field.required ?? template.is_required) ? 'Required' : 'Optional'}
                              </span>
                            </div>

                            <div className="relative mb-3 flex min-h-[160px] items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                              {isUploading ? (
                                <div className="flex flex-col items-center gap-2">
                                  <Loader2 size={22} className="animate-spin text-indigo-600" />
                                  <span className="text-xs font-medium text-gray-500">Uploading...</span>
                                </div>
                              ) : doc?.previewUrl ? (
                                <img src={doc.previewUrl} alt={field.label} className="h-full w-full object-cover" />
                              ) : (
                                <div className="text-center">
                                  <UploadCloud size={24} className="mx-auto mb-2 text-gray-400" />
                                  <p className="text-xs font-medium text-gray-500">Tap to Upload</p>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <label className="relative flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 shadow-sm">
                                <ImagePlus size={14} />
                                Gallery
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  onChange={(event) => handleDocumentFileChange(template.id, field.key, event)}
                                />
                              </label>
                              <label className="relative flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700">
                                <Camera size={14} />
                                Camera
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                  onChange={(event) => handleDocumentFileChange(template.id, field.key, event)}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(template.has_identify_number || template.has_expiry_date) ? (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 pt-3 border-t border-gray-200/60">
                        {template.has_identify_number ? (
                          <div>
                            <label className={labelClass}>
                              {typeLabel(template.identify_number_key) || `${template.name} Number`}
                            </label>
                            <input
                              value={documentMeta[template.id]?.identifyNumber || ''}
                              onChange={(event) => handleMetaChange(template.id, 'identifyNumber', event.target.value.toUpperCase())}
                              placeholder={`Enter ${typeLabel(template.identify_number_key) || 'document number'}`}
                              className={inputClass}
                            />
                          </div>
                        ) : null}
                        {template.has_expiry_date ? (
                          <div>
                            <label className={labelClass}>Expiry Date</label>
                            <input
                              type="date"
                              value={documentMeta[template.id]?.expiryDate || ''}
                              onChange={(event) => handleMetaChange(template.id, 'expiryDate', event.target.value)}
                              className={inputClass}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {submitting ? 'Creating Driver...' : 'Create Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDriver;
