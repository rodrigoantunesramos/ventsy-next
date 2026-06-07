// Compressão de imagem no navegador (redimensiona + WebP) e upload com progresso.
// Reduz o tamanho antes de enviar — upload rápido, storage barato, qualidade consistente.

export async function comprimirImagem(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    let { width, height } = img;
    if (width >= height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
    else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality));
    // só usa a versão comprimida se realmente ficou menor
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

type UploadResult = { ok: boolean; status: number; json: Record<string, unknown> };

export function uploadComProgresso(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  onProgress?: (frac: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let json: Record<string, unknown> = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* sem corpo */ }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error('Falha de rede no upload.'));
    xhr.send(formData);
  });
}
