import { Dispatch, SetStateAction, useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BannerImgSelector(props: {
  file: File | null;
  setFile: Dispatch<SetStateAction<File | null>>;
}) {
  const inputref = useRef<any>(null);

  const [imageToCrop, setImageToCrop] = useState<File | null>(null);

  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    height: number;
    width: number;
  } | null>(null);

  const createImage = (url: string) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any) => {
    const image: any = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx!.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const file = new File([blob!], "crop.jpeg", { type: "image/jpeg" });
        resolve(file);
      }, "image/jpeg");
    });
  };

  async function cropAndSave() {
    const croppedImage = await getCroppedImg(
      URL.createObjectURL(imageToCrop!),
      croppedAreaPixels
    );
    props.setFile(croppedImage as File);
    setShowCropper(false);
  }

  const onCropComplete = useCallback(
    async (croppedAreaPixels: {
      x: number;
      y: number;
      height: number;
      width: number;
    }) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    [props.file] // Adding dependencies for useCallback
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (files) {
      setImageToCrop(files[0]);
      setShowCropper(true);
    }
  };

  return (
    <div className="flex items-center justify-center flex-col gap-2">
      {showCropper && imageToCrop && (
        <div className="absolute top-0 right-0 bottom-0 left-0 z-[100] bg-black">
          <Button
            className="absolute top-0 right-0 m-4 w-10 rounded-full p-0 z-30"
            onClick={() => {
              setShowCropper(false);
              setCrop({ x: 0, y: 0 });
              setZoom(1);
              if (inputref.current) {
                inputref.current.value = "";
              }
              setImageToCrop(null);
            }}
          >
            <X />
          </Button>

          <Cropper
            image={URL.createObjectURL(imageToCrop)}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9} // Changed aspect ratio for banner
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />

          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
            <Button onClick={() => cropAndSave()}>Done</Button>
          </div>
        </div>
      )}

      <div
        className="h-36 w-96 min-h-36 min-w-96 rounded-3xl bg-gray-400 relative overflow-hidden"
        onClick={() => {
          inputref.current.click();
        }}
      >
        {props.file && (
          <img
            src={URL.createObjectURL(props.file)}
            alt="banner image"
            className="h-full w-full"
          />
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={handleChange}
        ref={inputref}
      />

      <p className="text-sm text-muted-foreground">Select a banner image.</p>
    </div>
  );
}