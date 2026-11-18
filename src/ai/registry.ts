/**
 * AI tool registry. Each tool declares honestly whether it can run today.
 *  - 'classical': implemented with deterministic image algorithms (no ML model).
 *  - 'needs-model': requires an open-source model (ONNX Runtime Web / NCNN) that is NOT bundled yet.
 * Add a new model-backed tool by registering an entry with status 'ready' and a run() function.
 */
export type AIStatus = 'classical' | 'needs-model';

export interface AIToolInfo {
  id: string;
  name: string;
  status: AIStatus;
  note: string;
  candidate?: string;
}

export const AI_TOOLS: AIToolInfo[] = [
  { id: 'enhance', name: 'Image Enhancer', status: 'classical', note: 'Auto levels/contrast from the histogram (no AI model).' },
  { id: 'denoise', name: 'Denoiser', status: 'classical', note: '3x3 median filter (no AI model).' },
  { id: 'bgremove', name: 'Background Remover', status: 'needs-model', note: 'Needs a segmentation model (e.g. RMBG / MODNet) via ONNX Runtime Web. Check the model license before bundling.', candidate: 'RMBG / MODNet' },
  { id: 'objremove', name: 'Object Remover', status: 'needs-model', note: 'Needs an inpainting model (e.g. LaMa) via ONNX Runtime.', candidate: 'LaMa' },
  { id: 'upscale', name: 'Image Upscaler', status: 'needs-model', note: 'Needs Real-ESRGAN (NCNN/ONNX). Slow on Intel CPUs for large images.', candidate: 'Real-ESRGAN' },
  { id: 'generate', name: 'Image Generator', status: 'needs-model', note: 'Stable Diffusion needs several GB of RAM/disk and is very slow on Intel CPUs; likely impractical on a 16 GB Intel Mac.', candidate: 'Stable Diffusion (small/LCM variants)' },
  { id: 'genfill', name: 'Generative Fill', status: 'needs-model', note: 'Needs a diffusion inpainting model; same CPU limits as the generator.' },
  { id: 'bggen', name: 'Background Generator', status: 'needs-model', note: 'Depends on the image generator.' },
  { id: 'face', name: 'Face Enhancer', status: 'needs-model', note: 'Needs a face restoration model (e.g. GFPGAN/CodeFormer - check licenses).' },
  { id: 'expand', name: 'Image Expansion', status: 'needs-model', note: 'Needs an outpainting model.' },
];
