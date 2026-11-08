/**
 * Reduz fotos antes de enviar: foto de celular tem 3 a 6 MB, e no banco
 * free cada byte conta. Sai sempre JPEG. PDF passa direto.
 */

async function carregar(arquivo: Blob): Promise<ImageBitmap> {
  try {
    // from-image: respeita a rotacao do EXIF (foto deitada do iPhone).
    return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Não foi possível ler a imagem. Tente uma foto JPG ou PNG.");
  }
}

function paraJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Não foi possível preparar a imagem."))), "image/jpeg", qualidade),
  );
}

/** Lado maior ate `maxLado` px. Fundo branco: PNG transparente nao vira preto no JPEG. */
export async function reduzirImagem(arquivo: Blob, maxLado = 1600, qualidade = 0.75): Promise<Blob> {
  const img = await carregar(arquivo);
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return paraJpeg(canvas, qualidade);
}

/** Foto de perfil: recorte quadrado do centro, `lado` px. */
export async function fotoQuadrada(arquivo: Blob, lado = 256): Promise<Blob> {
  const img = await carregar(arquivo);
  const menor = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, lado, lado);
  ctx.drawImage(img, (img.width - menor) / 2, (img.height - menor) / 2, menor, menor, 0, 0, lado, lado);
  img.close();
  return paraJpeg(canvas, 0.85);
}

/** Comprovante pronto para envio: imagem reduzida (com nome .jpg) ou o PDF como veio. */
export async function prepararComprovante(arquivo: File): Promise<{ blob: Blob; nome: string }> {
  if (arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf")) {
    if (arquivo.size > 4 * 1024 * 1024) throw new Error("PDF muito grande (máximo 4 MB).");
    return { blob: arquivo.type ? arquivo : new Blob([arquivo], { type: "application/pdf" }), nome: arquivo.name };
  }
  const blob = await reduzirImagem(arquivo);
  const base = arquivo.name.replace(/\.[^.]+$/, "") || "comprovante";
  return { blob, nome: `${base}.jpg` };
}

export function tamanhoTexto(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
