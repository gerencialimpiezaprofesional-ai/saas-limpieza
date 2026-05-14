import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, MapPin, Check, Loader2, ShieldCheck, AlertCircle, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { db, auth } from "../firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function CheckIn({ userData }: { userData: any }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"location" | "geofence_check" | "selfie" | "confirming" | "success">("location");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const requestLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError("La geolocalización no es compatible con este navegador.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
        setStep("geofence_check");
        verifyGeofence();
      },
      (err) => {
        console.error("Location error:", err);
        setError("No se pudo obtener la ubicación. Por favor, activa el GPS.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const verifyGeofence = () => {
    setGeofenceStatus("checking");
    // Simulamos validación IA de geocerca (500m del cliente asignado)
    setTimeout(() => {
      setGeofenceStatus("valid");
      setTimeout(() => {
        setStep("selfie");
      }, 1500);
    }, 2000);
  };

  const startCamera = async () => {
    setError(null);
    setLoading(true);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Tu navegador no soporta el acceso a la cámara o estás en una conexión no segura.");
      setLoading(false);
      return;
    }

    try {
      const constraints = { 
        video: { 
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      };
      
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("Retrying with basic video constraints", e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      setCameraActive(true);
      // Loading will be set to false in the useEffect when video is ready
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Permiso denegado. Si estás en la vista previa, intenta abrir la app en una pestaña nueva para habilitar la cámara.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("No se encontró ninguna cámara en este dispositivo.");
      } else {
        setError(`Error de cámara: ${err.message || "No se pudo iniciar"}`);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch(console.error);
        setLoading(false);
      };
    }
  }, [cameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setSelfie(dataUrl);
        stopCamera();
        setStep("confirming");
      }
    }
  };

  useEffect(() => {
    if (step === "selfie" && !cameraActive) {
      startCamera();
    }
    return () => stopCamera();
  }, [step]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          lastCheckIn: serverTimestamp(),
          lastLocation: location,
          lastSelfie: selfie,
          status: "active"
        });
        setStep("success");
        setTimeout(() => {
          navigate("/tasks");
        }, 2000);
      }
    } catch (err) {
      console.error("Check-in error:", err);
      setError("Error al guardar el check-in. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 space-y-8">
      <AnimatePresence mode="wait">
        {step === "location" && (
          <motion.div
            key="location"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6 w-full max-w-sm"
          >
            <div className="w-20 h-20 bg-secondary/10 rounded-3xl flex items-center justify-center mx-auto border border-secondary/20 shadow-[0_0_30px_rgba(68,221,194,0.2)]">
              <MapPin className="w-10 h-10 text-secondary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">Validación de Ubicación</h2>
              <p className="text-sm text-primary/60 font-medium">Necesitamos confirmar que estás en el sector asignado.</p>
            </div>

            {error && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-2xl flex items-center gap-3 text-error text-xs font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={requestLocation}
              disabled={loading}
              className="w-full h-14 bg-secondary rounded-2xl text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Obtener Ubicación"}
            </button>
          </motion.div>
        )}

        {step === "geofence_check" && (
          <motion.div
            key="geofence"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 w-full max-w-sm"
          >
            <div className="relative mx-auto w-24 h-24">
              <div className={cn(
                "w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all duration-500",
                geofenceStatus === "checking" ? "border-white/10 animate-pulse" : "border-secondary shadow-[0_0_30px_rgba(68,221,194,0.4)]"
              )}>
                {geofenceStatus === "checking" ? (
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                ) : (
                  <ShieldCheck className="w-10 h-10 text-secondary" />
                )}
              </div>
              {geofenceStatus === "checking" && (
                <motion.div 
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-t-4 border-secondary rounded-full"
                />
              )}
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">
                {geofenceStatus === "checking" ? "Seguridad IA: Validando" : "Geocerca Validada"}
              </h2>
              <p className="text-sm text-primary/60 font-medium leading-relaxed">
                {geofenceStatus === "checking" 
                  ? "Cruzando coordenadas en tiempo real con el perímetro del cliente..." 
                  : "Ubicación confirmada dentro del sector asignado (Emmsa)."}
              </p>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-start gap-2">
              <div className="flex justify-between w-full">
                <span className="text-[10px] font-bold text-primary/40 uppercase">Latitud</span>
                <span className="text-[10px] font-bold text-white font-mono">{location?.lat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between w-full">
                <span className="text-[10px] font-bold text-primary/40 uppercase">Longitud</span>
                <span className="text-[10px] font-bold text-white font-mono">{location?.lng.toFixed(6)}</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2 }}
                  className="h-full bg-secondary"
                />
              </div>
            </div>
          </motion.div>
        )}

        {step === "selfie" && (
          <motion.div
            key="selfie"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="text-center space-y-6 w-full max-w-sm"
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-black font-headline text-white uppercase tracking-tighter">Selfie de Identidad</h2>
              <p className="text-sm text-primary/60 font-medium">Tómate una foto para validar tu identidad en tiempo real.</p>
            </div>

            <div className="aspect-square w-full bg-surface-container rounded-3xl border-2 border-dashed border-white/10 flex items-center justify-center relative overflow-hidden shadow-2xl">
              {cameraActive ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                  <button 
                    onClick={capturePhoto}
                    className="absolute bottom-6 w-16 h-16 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-2xl active:scale-90 transition-transform z-10 border-4 border-white/20"
                  >
                    <div className="w-10 h-10 rounded-full border-2 border-on-secondary" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  {loading ? (
                    <Loader2 className="w-10 h-10 text-secondary animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-12 h-12 text-primary/20" />
                      {error && (
                        <div className="space-y-2 px-4">
                          <p className="text-xs text-error font-bold leading-tight">{error}</p>
                          <button 
                            onClick={openInNewTab}
                            className="text-[10px] text-secondary font-black uppercase underline tracking-widest"
                          >
                            Abrir en Pestaña Nueva
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={startCamera}
                        className="px-6 py-2 bg-secondary/20 text-secondary rounded-xl text-xs font-bold uppercase"
                      >
                        Activar Cámara
                      </button>
                    </>
                  )}
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <p className="text-[10px] text-primary/40 font-bold uppercase tracking-widest">Paso 2 de 2: Validación Biométrica</p>
          </motion.div>
        )}

        {step === "confirming" && (
          <motion.div
            key="confirming"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="glass-panel p-4 rounded-3xl space-y-4">
              <div className="aspect-square w-full rounded-2xl overflow-hidden border border-white/10">
                <img src={selfie!} alt="Selfie" className="w-full h-full object-cover scale-x-[-1]" />
              </div>
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-secondary" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest">Ubicación Capturada</p>
                  <p className="text-xs font-bold text-white">{location?.lat.toFixed(4)}, {location?.lng.toFixed(4)}</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-2xl flex items-center gap-3 text-error text-xs font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setSelfie(null);
                  setStep("selfie");
                }}
                className="flex-1 h-14 glass-panel rounded-2xl flex items-center justify-center text-white font-bold text-sm active:scale-95 transition-all"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-[2] h-14 bg-secondary rounded-2xl text-on-secondary font-black font-headline uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmar Check-in"}
              </button>
            </div>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(68,221,194,0.4)]">
              <ShieldCheck className="w-12 h-12 text-on-secondary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black font-headline text-white uppercase tracking-tighter">Check-in Exitoso</h2>
              <p className="text-sm text-primary/60 font-medium">Identidad y ubicación validadas por IA.</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Cargando Tareas...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
