import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { X, Upload, Check, Plus, Trash2 } from 'lucide-react'
import type { Producto, Pack } from '../types'

const packageFormSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150, 'Máximo 150 caracteres'),
  slug: z.string().min(1, 'El slug es obligatorio').max(150, 'Máximo 150 caracteres'),
  descripcion: z.string().optional().nullable(),
  estado: z.boolean().default(true),
  productos: z
    .array(
      z.object({
        id_producto: z.coerce.number().gt(0, 'Selecciona un producto'),
        cantidad: z.coerce.number().gt(0, 'Mínimo 1 unidad'),
      })
    )
    .min(2, 'Debe contener mínimo 2 productos distintos'),
}).refine((data) => {
  const ids = data.productos.map(p => p.id_producto);
  const uniqueIds = new Set(ids);
  return ids.length === uniqueIds.size;
}, {
  message: 'Los productos dentro de un paquete no pueden repetirse',
  path: ['productos'], 
});

type PackageFormValues = z.infer<typeof packageFormSchema>

interface AdminPackageFormProps {
  initialData?: Pack | undefined
  productsList: Producto[]
  onSubmit: (formData: FormData) => void
  onCancel: () => void
  isSubmitting: boolean
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

export function AdminPackageForm({
  initialData,
  productsList,
  onSubmit,
  onCancel,
  isSubmitting,
}: AdminPackageFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.imagen_url || null)

  const defaultProductos = initialData?.productos.map((p) => ({
    id_producto: p.id_producto,
    cantidad: p.cantidad,
  })) || [
    { id_producto: 0, cantidad: 1 },
    { id_producto: 0, cantidad: 1 },
  ]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<PackageFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(packageFormSchema) as any,
    defaultValues: {
      nombre: initialData?.nombre || '',
      slug: initialData?.slug || '',
      descripcion: initialData?.descripcion || '',
      estado: initialData?.estado !== false,
      productos: defaultProductos,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'productos',
  })

  const formNombre = watch('nombre')
  const formEstado = watch('estado')
  const formProductosSelected = watch('productos')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library
    if (formNombre && (!initialData || !watch('slug'))) {
      setValue('slug', slugify(formNombre))
    }
  }, [formNombre, initialData, setValue, watch])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleFormSubmit = (values: PackageFormValues) => {
    const formData = new FormData()
    formData.append('nombre', values.nombre)
    formData.append('slug', values.slug)
    
    if (values.descripcion) {
      formData.append('descripcion', values.descripcion)
    }
    formData.append('estado', String(values.estado))

    const cleanedProductos = values.productos.map((p) => ({
      id_producto: Number(p.id_producto),
      cantidad: Number(p.cantidad),
    }))
    formData.append('productos_json', JSON.stringify(cleanedProductos))

    if (selectedFile) {
      formData.append('image', selectedFile)
    }

    onSubmit(formData)
  }

  // Prevenir crasheos si formProductosSelected es undefined en el primer render
  const calculatedTotalPrice = (formProductosSelected || []).reduce((sum, item) => {
      const prod = productsList.find((p) => p.id_producto === Number(item.id_producto))
      if (prod && Number(item.cantidad) > 0) {
        // Forzamos la conversión a Number por si el backend lo envía como string
        return sum + Number(prod.precio) * Number(item.cantidad)
      }
      return sum;
    }, 0)
  // Extraemos el mensaje de error de la raíz del array (usualmente insertado por el .refine)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arrayRootError = (errors.productos as any)?.root?.message || (errors.productos as any)?.message

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      <div className="flex items-center justify-between border-b border-stone-100 p-6">
        <div>
          <h2 className="text-xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {initialData ? 'Editar Paquete Comercial' : 'Crear Nuevo Paquete'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {initialData ? 'Modifica la estructura, slug o componentes del paquete' : 'Crea una composición de productos con precio agrupado'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider mb-1.5">
                Nombre del Paquete <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Pack Amor de Trufas"
                {...register('nombre')}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b] transition-all text-[#2a1115]"
              />
              {errors.nombre && (
                <p className="text-xs text-red-500 font-semibold mt-1">{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider mb-1.5">
                Slug URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="ej-pack-amor-de-trufas"
                {...register('slug')}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b] transition-all text-[#2a1115] font-mono text-xs"
              />
              {errors.slug && (
                <p className="text-xs text-red-500 font-semibold mt-1">{errors.slug.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider mb-1.5">
                Descripción
              </label>
              <textarea
                placeholder="Ingresa los detalles promocionales de este pack..."
                rows={3}
                {...register('descripcion')}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5c0f1b]/20 focus:border-[#5c0f1b] transition-all text-[#2a1115] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider mb-1.5">
                Imagen de Portada (Opcional)
              </label>
              <div className="flex gap-4 items-center bg-stone-50 border border-stone-200 border-dashed p-4 rounded-xl">
                <div className="relative h-20 w-20 bg-stone-100 border border-stone-200 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Vista previa" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-6 w-6 text-stone-400" />
                  )}
                </div>

                <div className="flex-1 flex flex-col">
                  <span className="text-xs font-bold text-[#2a1115]">Adjuntar Portada</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG o WEBP. Máx 5MB.</span>
                  
                  <label className="mt-2.5 self-start inline-flex items-center gap-1.5 bg-white border border-stone-200 hover:bg-stone-50 px-3 py-1.5 rounded-lg text-xs font-bold text-[#5c0f1b] shadow-xs transition-colors cursor-pointer select-none">
                    <Upload className="h-3.5 w-3.5" />
                    Seleccionar Imagen
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-stone-50 border border-stone-200 rounded-xl">
              <div>
                <span className="text-xs font-bold text-[#2a1115]">Activo en catálogo</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Si se desactiva, los clientes no podrán comprar ni ver este paquete
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formEstado}
                  onChange={(e) => setValue('estado', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5c0f1b]"></div>
              </label>
            </div>
          </div>

          <div className="bg-stone-50/50 border border-[#5c0f1b]/10 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold text-[#5c0f1b] uppercase tracking-wider">
                  Productos Componentes <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => append({ id_producto: 0, cantidad: 1 })}
                  className="inline-flex items-center gap-1 bg-white border border-[#5c0f1b]/20 hover:bg-stone-100 text-[#5c0f1b] font-bold text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar Trufa
                </button>
              </div>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {fields.map((field, index) => {
                  return (
                    <div key={field.id} className="flex gap-2 items-start bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                      <div className="flex-1">
                        <select
                          {...register(`productos.${index}.id_producto`)}
                          className={`w-full px-3 py-2 text-xs bg-stone-50 border ${errors.productos?.[index]?.id_producto ? 'border-red-500' : 'border-stone-200'} rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5c0f1b] cursor-pointer`}
                        >
                          <option value="0">Seleccionar Trufa...</option>
                          {productsList.map((prod) => (
                            <option key={prod.id_producto} value={prod.id_producto}>
                              {/* Aplicamos Number() antes del toFixed */}
                              {prod.nombre} (S/. {Number(prod.precio).toFixed(2)})
                            </option>
                          ))}
                        </select>
                        {/* Error de validación del Select */}
                        {errors.productos?.[index]?.id_producto && (
                          <p className="text-[10px] text-red-500 font-semibold mt-1">
                            {errors.productos[index]?.id_producto?.message}
                          </p>
                        )}
                      </div>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          placeholder="Cant."
                          {...register(`productos.${index}.cantidad`)}
                          className={`w-full px-3 py-2 text-xs bg-stone-50 border ${errors.productos?.[index]?.cantidad ? 'border-red-500' : 'border-stone-200'} rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5c0f1b]`}
                        />
                        {/* Error de validación del Input */}
                        {errors.productos?.[index]?.cantidad && (
                          <p className="text-[10px] text-red-500 font-semibold mt-1">
                            {errors.productos[index]?.cantidad?.message}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (fields.length > 2) {
                            remove(index)
                          }
                        }}
                        disabled={fields.length <= 2}
                        className="p-2 text-stone-400 mt-0.5 hover:text-red-500 disabled:opacity-30 disabled:hover:text-stone-400 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer border-none"
                        aria-label="Eliminar componente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Error global del array (.refine) */}
              {arrayRootError && (
                <p className="text-xs text-red-500 font-semibold mt-2.5">{arrayRootError}</p>
              )}
            </div>

            <div className="bg-[#5c0f1b]/5 border border-[#5c0f1b]/10 rounded-xl p-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#5c0f1b]/70">Valor Promocional</span>
                <p className="text-xs text-stone-500 leading-snug">Suma total de los componentes en tiempo real</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-[#5c0f1b]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  S/. {Number(calculatedTotalPrice || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-stone-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-stone-500 hover:text-stone-700 font-bold hover:bg-stone-100 disabled:opacity-50 text-sm transition-all border-none cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 bg-[#5c0f1b] text-white hover:bg-[#7a1525] px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-[#5c0f1b]/15 disabled:opacity-50 transition-all border-none cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="h-4.5 w-4.5" />
                {initialData ? 'Guardar Cambios' : 'Crear Paquete'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}