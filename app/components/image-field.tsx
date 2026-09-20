"use client";
import { useEffect, useState, useRef } from "react";
import { responseJson } from "../../lib/api-client";
import { Media } from "../../lib/models";

export type ImageChange = File | null | undefined; // undefined keeps the saved image; null removes it.
export async function saveImage(restaurant: string, kind: string, change: ImageChange, dish?: string) {
  if (change === undefined) return;
  const params = new URLSearchParams({ restaurant, kind, ...(dish ? { dish } : {}) });
  return responseJson<{ media: Media | null; warning?: string }>(await fetch(`/api/media?${params}`, {
    method: change === null ? "DELETE" : "POST", body: change || undefined,
  }));
}
export function ImageField({ current, value, onChange, disabled = false }: {
  current?: string; value: ImageChange; onChange: (value: ImageChange) => void; disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!value) { setPreview(undefined); return; }
    const url = URL.createObjectURL(value); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  const src = value === null ? undefined : preview || current;
  return <fieldset className="imageField" disabled={disabled}>
    <legend>Image</legend>
    {src ? <img className="imagePreview" src={src} alt="Image preview" /> : <p>No image selected.</p>}
    <label>{src ? "Replace image" : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ""; setError("");
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024 || !file.size) {
        setError("Choose a PNG, JPEG, or WebP image up to 3 MB."); return;
      }
      onChange(file);
    }} /></label>
    <small>PNG, JPEG, or WebP · up to 3 MB. Changes apply when you save.</small>
    {src && <button type="button" className="outline" onClick={() => onChange(null)}>Remove image</button>}
    {value !== undefined && <button type="button" className="outline" onClick={() => onChange(undefined)}>Undo image change</button>}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}

export function StorefrontImageEditor({ restaurantId, kind, current, onSaved, children }: {
  restaurantId: string; kind: "logo" | "cover"; current?: string; onSaved: (media: Media | null) => void; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [change, setChange] = useState<ImageChange>();
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  return <div className={`contextImageEditor ${kind}`}>
    <button type="button" className={kind === "logo" ? "logoEditTrigger" : "outline imageEditButton"} aria-label={kind === "logo" ? "Edit restaurant logo" : undefined} title={kind === "logo" ? "Click to edit logo" : undefined} aria-expanded={open} onClick={() => { setOpen(true); setError(""); setChange(undefined); }}>
      {kind === "cover" ? "Edit Cover Photo" : children}
    </button>
    {open && <dialog ref={dialog} className="storeImageDialog" onCancel={event=>{if(busy)event.preventDefault();else setOpen(false);}} aria-label={kind === "cover" ? "Edit cover photo" : "Edit logo"}>
      <h2>{kind === "cover" ? "Edit cover photo" : "Edit restaurant logo"}</h2>
      <ImageField current={current} value={change} onChange={setChange} disabled={busy} />
      {error && <p role="alert">{error}</p>}
      <div className="formActions"><button type="button" className="button" disabled={busy || change === undefined} onClick={async () => {
        setBusy(true); setError("");
        try { const result=await saveImage(restaurantId, kind, change); if(result)onSaved(result.media); if(result?.warning){setError(result.warning);setChange(undefined);}else setOpen(false); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save image."); }
        finally { setBusy(false); }
      }}>{busy ? "Saving…" : "Save image"}</button>
      <button type="button" className="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
    </dialog>}
  </div>;
}
