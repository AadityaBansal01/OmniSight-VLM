"""
Florence-2 Vision-Language Model captioner.
Uses a singleton pattern so the model is loaded exactly once, even across multiple requests.
"""
import cv2
from typing import List, Tuple, Callable, Optional

from app.config import FLORENCE_MODEL_ID, CAPTION_PROMPT, MAX_NEW_TOKENS


class KeyframeCaptioner:
    """
    Singleton captioner that lazy-loads Florence-2 on first use.
    Subsequent calls reuse the same model instance.
    """
    _instance = None
    _model = None
    _processor = None
    _device = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _ensure_loaded(self):
        """Load model if not already loaded."""
        if self._model is not None:
            return

        import torch
        from transformers import AutoProcessor, AutoModelForCausalLM

        if torch.cuda.is_available():
            self._device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self._device = "mps"
        else:
            self._device = "cpu"
        print(f"[Captioner] Loading {FLORENCE_MODEL_ID} on {self._device.upper()}...")

        self._processor = AutoProcessor.from_pretrained(
            FLORENCE_MODEL_ID, trust_remote_code=True
        )
        self._model = AutoModelForCausalLM.from_pretrained(
            FLORENCE_MODEL_ID, trust_remote_code=True, attn_implementation="eager"
        ).to(self._device).eval()

        print(f"[Captioner] Model ready on {self._device.upper()}.")

    def caption_frame(self, frame_bgr, prompt: str = CAPTION_PROMPT) -> str:
        """
        Takes a raw OpenCV BGR frame and returns a natural language caption.
        """
        self._ensure_loaded()
        import torch
        from PIL import Image

        rgb_image = Image.fromarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
        inputs = self._processor(
            text=prompt, images=rgb_image, return_tensors="pt"
        ).to(self._device)

        with torch.no_grad():
            generated_ids = self._model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=MAX_NEW_TOKENS,
                num_beams=3,
                use_cache=False,
            )

        caption_raw = self._processor.batch_decode(
            generated_ids, skip_special_tokens=False
        )[0]
        parsed = self._processor.post_process_generation(
            caption_raw,
            task=prompt,
            image_size=(rgb_image.width, rgb_image.height),
        )
        return parsed[prompt].strip()

    def caption_keyframes(
        self,
        keyframes: List[Tuple[float, any, Optional[int], Optional[Tuple[float,float,float,float]]]],
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> List[dict]:
        """
        Batch-caption a list of (timestamp, frame, track_id, bbox) tuples.

        Returns:
            List of {"timestamp": float, "caption": str, "track_id": int|None, "bbox": tuple|None}
        """
        self._ensure_loaded()
        results = []
        total = len(keyframes)

        def crop_frame(img, bbox, pad=20):
            x_norm, y_norm, w_norm, h_norm = bbox
            H, W = img.shape[:2]
            x = int(x_norm * W)
            y = int(y_norm * H)
            w = int(w_norm * W)
            h = int(h_norm * H)
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(W, x + w + pad)
            y2 = min(H, y + h + pad)
            return img[y1:y2, x1:x2]

        print(f"[Captioner] Processing {total} keyframes...")
        for idx, (timestamp, frame, track_id, bbox) in enumerate(keyframes):
            parts = []
            full_caption = self.caption_frame(frame, prompt=CAPTION_PROMPT)
            parts.append(full_caption)

            if bbox is not None and bbox[2] > 0 and bbox[3] > 0:
                cropped = crop_frame(frame, bbox)
                if cropped.shape[0] > 10 and cropped.shape[1] > 10:
                    crop_caption = self.caption_frame(cropped, prompt="<MORE_DETAILED_CAPTION>")
                    if crop_caption and len(crop_caption) > 5:
                        parts.append(f"Subject details: {crop_caption}")

            # Extract visible text / signs / license plate text
            try:
                ocr_text = self.caption_frame(frame, prompt="<OCR>")
                if ocr_text and ocr_text.strip() and len(ocr_text.strip()) > 1:
                    parts.append(f"Visible text and signs: {ocr_text.strip()}")
            except Exception:
                pass

            caption = " ".join(parts)
                
            results.append({
                "timestamp": timestamp,
                "caption": caption,
                "track_id": track_id,
                "bbox": bbox
            })

            progress = (idx + 1) / total
            msg = f"Captioned frame {idx + 1}/{total} @ {timestamp:.1f}s"
            print(f"  [{idx + 1}/{total}] {timestamp:06.2f}s → {caption[:80]}...")

            if progress_callback:
                progress_callback(progress, msg)

        return results
