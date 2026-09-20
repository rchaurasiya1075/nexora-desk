import { useEffect, useState } from "react";

export function QrCode({ value, size = 196 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!value) {
      setSrc("");
      return;
    }
    let live = true;
    void import("qrcode")
      .then((mod) =>
        mod.toDataURL(value, {
          width: size,
          margin: 1,
          color: { dark: "#09090b", light: "#f2f1ed" },
        }),
      )
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setSrc("");
      });
    return () => {
      live = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className="grid place-items-center rounded-sm bg-fg text-xs text-bg"
        style={{ width: size, height: size }}
      >
        QR
      </div>
    );
  }
  return (
    <img
      src={src}
      alt="Payment QR"
      width={size}
      height={size}
      className="rounded-sm bg-fg"
    />
  );
}
