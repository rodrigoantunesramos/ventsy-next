"use client";

import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useEffect, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { uploadAvatar } from "src/lib/UploadAvatarFuncionario";


export function EmployeeModal({ onClose, onSave, employee }: any) {

  const {
  register,
  handleSubmit,
  setValue,
  watch, // 👈 ADICIONA ISSO
  formState: { errors, isValid }
} = useForm<any>({
  mode: "onChange"
});

  const [avatar, setAvatar] = useState<string | null>(null);
  const [docType, setDocType] = useState<"CPF" | "CNPJ">("CPF");

  const [imageSrc, setImageSrc] = useState<any>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    if (employee) {
      Object.entries(employee).forEach(([k, v]) => setValue(k, v));
      setAvatar(employee.avatar || null);
    }
  }, []);

  // ================= UPLOAD =================
  const handleImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const onDrop = (e: any) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImage(file);
  };

  const onCropComplete = useCallback((_: any, cropped: any) => {
    setCroppedAreaPixels(cropped);
  }, []);

  const getCroppedImage = async () => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((r) => (image.onload = r));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        resolve(new File([blob!], "avatar.jpg", { type: "image/jpeg" }));
      }, "image/jpeg");
    });
  };

  const handleCropSave = async () => {
    const file = await getCroppedImage();
    const url = await uploadAvatar(file, avatar);
    if (url) setAvatar(url);
    setImageSrc(null);
  };

  const onSubmit = (data: any) => {
    onSave({
      id: employee?.id || crypto.randomUUID(),
      avatar,
      ...data,
    });
    onClose();
  };

  const inputBase =
    "w-full border rounded-xl px-3 py-2 text-sm bg-white outline-none transition";

  const getInputClass = (field: string) =>
    `${inputBase} ${
      errors[field]
        ? "border-red-500"
        : "border-gray-200 focus:ring-2 focus:ring-black/80"
    }`;

  const label = "text-xs text-gray-500 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">

      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border"
      >

        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-5 border-b">
          <div>
            <h2 className="font-semibold text-lg">Novo Funcionário</h2>
            <p className="text-sm text-gray-500">
              Preencha os dados do colaborador
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-gray-100 p-2 rounded-lg">
            ✕
          </button>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
        >

          {/* FOTO */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border border-dashed rounded-2xl p-4 flex items-center gap-4 hover:bg-gray-50 transition cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
              {avatar ? (
                <img src={avatar} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-400">Foto</span>
              )}
            </div>

            <div>
              <p className="text-sm font-medium">Foto do funcionário</p>
              <p className="text-xs text-gray-500">
                Clique ou arraste uma imagem
              </p>
            </div>

            <input
              type="file"
              className="hidden"
              onChange={(e) => handleImage(e.target.files[0])}
            />
          </div>

          {/* NOME + CARGO */}
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <p className={label}>Nome *</p>
              <input {...register("name", { required: true })} className={getInputClass("name")} />
            </div>

            <div>
              <p className={label}>Cargo *</p>
              <input {...register("role", { required: true })} className={getInputClass("role")} />
            </div>
          </div>

          {/* EMAIL */}
          <div>
            <p className={label}>Email *</p>
            <input
              type="email"
              {...register("email", { required: true })}
              className={getInputClass("email")}
              placeholder="email@empresa.com"
            />
          </div>

          {/* DATA */}
          <div>
            <p className={label}>Data de admissão *</p>
            <input type="date" {...register("admissionDate", { required: true })} className={getInputClass("admissionDate")} />
          </div>

          {/* DOCUMENTO */}
          <div>
            <p className={label}>Documento *</p>

            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit mb-3">
              <button
                type="button"
                onClick={() => setDocType("CPF")}
                className={`px-4 py-1.5 text-sm rounded-lg ${
                  docType === "CPF" ? "bg-white shadow" : "text-gray-500"
                }`}
              >
                CPF
              </button>

              <button
                type="button"
                onClick={() => setDocType("CNPJ")}
                className={`px-4 py-1.5 text-sm rounded-lg ${
                  docType === "CNPJ" ? "bg-white shadow" : "text-gray-500"
                }`}
              >
                CNPJ
              </button>
            </div>

            {docType === "CPF" ? (
              <input
                className={getInputClass("cpf")}
                placeholder="000.000.000-00"
                {...register("cpf", { required: true })}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  v = v.replace(/(\d{3})(\d)/, "$1.$2");
                  v = v.replace(/(\d{3})(\d)/, "$1.$2");
                  v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
                  setValue("cpf", v, { shouldValidate: true });
                }}
              />
            ) : (
              <input
                className={getInputClass("cnpj")}
                placeholder="00.000.000/0000-00"
                {...register("cnpj", { required: true })}
              />
            )}
          </div>

          {/* CONTRATO + SALÁRIO */}
          <div className="grid grid-cols-2 gap-4">
            <select {...register("contractType", { required: true })} className={getInputClass("contractType")}>
              <option value="">Selecione</option>
              <option>CLT</option>
              <option>PJ</option>
              <option>MEI</option>
              <option>Estágio</option>
              <option>Diária</option>
            </select>

            <input
              placeholder="R$ 0,00"
              className={getInputClass("salary")}
              {...register("salary", { required: true })}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, "");
                const number = Number(v) / 100;
                setValue("salary", number, { shouldValidate: true });
              }}
              value={
                watch("salary")
                  ? Number(watch("salary")).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  : ""
              }
            />
          </div>

          {/* ENDEREÇO */}
          <div className="grid grid-cols-3 gap-4">
            <input {...register("street", { required: true })} className={getInputClass("street")} placeholder="Rua" />
            <input {...register("city", { required: true })} className={getInputClass("city")} placeholder="Cidade" />
            <input {...register("state", { required: true })} className={getInputClass("state")} placeholder="Estado" />
          </div>

        </form>

        {/* FOOTER */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
          <span className="text-xs text-gray-400">
            * Campos obrigatórios
          </span>

          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm px-4 py-2">
              Cancelar
            </button>

            <button
              disabled={!isValid}
              className={`px-6 py-2 rounded-xl ${
                isValid
                  ? "bg-black text-white hover:opacity-90"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Salvar
            </button>
          </div>
        </div>

        {/* CROP */}
        {imageSrc && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
            <div className="bg-white p-4 rounded-xl">
              <div className="w-64 h-64 relative">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <button onClick={handleCropSave} className="mt-3">
                Confirmar
              </button>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}