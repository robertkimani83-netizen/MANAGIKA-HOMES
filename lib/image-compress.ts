// Shrinks a phone photo in the browser before it is sent: at most 1280 pixels
// on the long side, saved as a JPEG. A 5 MB camera photo becomes a few hundred
// KB, which is quick on mobile data and well under the server's size limit.
// Rejects when the file is not a picture the browser can read.
export function compressImageToJpeg(file: File, maxSide = 1280, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no canvas");
        context.fillStyle = "#ffffff"; // a transparent PNG becomes white, not black
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else reject(new Error("could not convert the photo"));
          },
          "image/jpeg",
          quality
        );
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("could not read the photo"));
    };
    image.src = url;
  });
}
