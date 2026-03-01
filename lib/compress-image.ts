const MAX_DIMENSION = 1200;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const JPEG_QUALITY = 0.85;

export async function compressImage(file: File): Promise<File> {
	if (file.size <= MAX_FILE_SIZE_BYTES && file.type === "image/jpeg") {
		return file;
	}

	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);
			const canvas = document.createElement("canvas");
			let { width, height } = img;

			if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
				if (width > height) {
					height = Math.round((height * MAX_DIMENSION) / width);
					width = MAX_DIMENSION;
				} else {
					width = Math.round((width * MAX_DIMENSION) / height);
					height = MAX_DIMENSION;
				}
			}

			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Canvas context not available"));
				return;
			}
			ctx.drawImage(img, 0, 0, width, height);

			let quality = JPEG_QUALITY;
			const tryBlob = () => {
				canvas.toBlob(
					(blob) => {
						if (!blob) {
							reject(new Error("Failed to compress image"));
							return;
						}
						if (blob.size > MAX_FILE_SIZE_BYTES && quality > 0.3) {
							quality -= 0.1;
							tryBlob();
						} else {
							const name = file.name.replace(/\.[^.]+$/, "") || "image";
							resolve(
								new File([blob], `${name}.jpg`, {
									type: "image/jpeg",
									lastModified: Date.now(),
								}),
							);
						}
					},
					"image/jpeg",
					quality,
				);
			};
			tryBlob();
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Failed to load image"));
		};

		img.src = url;
	});
}
