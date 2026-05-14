import React, { useState, useEffect } from "react";
import { Star, Loader2, Package, Gift, Clock, ShoppingBag, Trophy } from "lucide-react";
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import SocialFeed from "./SocialFeed";

interface Reward {
  id: string;
  title: string;
  pts: number;
  img: string;
  description?: string;
}

interface LeaderUser {
  id: string;
  name: string;
  points: number;
  photo?: string;
}

export default function RedemptionStore({ userData }: { userData: any }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'store' | 'feed'>('store');

  useEffect(() => {
    if (!userData?.tenantId) return;

    // Fetch Rewards
    if (!userData.tenantId || !db) return;
    const unsubRewards = onSnapshot(doc(db, "tenants", userData.tenantId), (snapshot) => {
      setLoading(false);
      if (snapshot.exists()) {
        const tenantData = snapshot.data();
        setRewards(tenantData.rewards || [
          { id: "r1", title: "Bono $50 USD", pts: 5000, img: "https://picsum.photos/seed/bonus1/400/300", description: "Bono en efectivo acreditado en nómina." },
          { id: "r2", title: "Día Libre", pts: 8000, img: "https://picsum.photos/seed/bonus2/400/300", description: "Un día libre con goce de sueldo." },
          { id: "r3", title: "Gift Card Amazon", pts: 3000, img: "https://picsum.photos/seed/bonus3/400/300", description: "Tarjeta de regalo digital de $20 USD." },
          { id: "r4", title: "Kit Limpieza Pro", pts: 2500, img: "https://picsum.photos/seed/bonus4/400/300", description: "Kit de herramientas premium ECOLAB." },
        ]);
      }
    }, (error) => {
      console.error("Error fetching rewards:", error);
      setLoading(false);
    });

    // Fetch Leaderboard (Rank Top 3)
    const qLeaders = query(
      collection(db, "users"),
      where("tenantId", "==", userData.tenantId),
      orderBy("points", "desc"),
      limit(3)
    );

    const unsubLeaders = onSnapshot(qLeaders, (snapshot) => {
      const leaders = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || "Colaborador",
        points: doc.data().points || 0,
        photo: doc.data().lastSelfie || `https://api.dicebear.com/7.x/avataaars/svg?seed=${doc.data().email}`
      }));
      setLeaderboard(leaders);
    });

    return () => {
      unsubRewards();
      unsubLeaders();
    };
  }, [userData?.tenantId]);

  const handleRedeem = async (reward: Reward) => {
    if ((userData.points || 0) < reward.pts) {
      toast.error("Puntos insuficientes para este canje.");
      return;
    }

    setRedeemingId(reward.id);
    try {
      if (!userData.uid || !db) throw new Error("No user ID or DB");
      // 1. Restar puntos al usuario
      await updateDoc(doc(db, "users", userData.uid), {
        points: increment(-reward.pts)
      });

      // 2. Registrar el canje en la colección 'redemptions'
      await addDoc(collection(db, "redemptions"), {
        userId: userData.uid,
        userName: userData.name || userData.email || "Usuario",
        rewardId: reward.id,
        rewardTitle: reward.title,
        points: reward.pts,
        status: 'pending', // pending, approved, rejected, applied
        tenantId: userData.tenantId,
        createdAt: serverTimestamp(),
      });

      // 3. Crear notificación para RH
      await addDoc(collection(db, "notifications"), {
        type: 'redemption',
        title: 'Nuevo Canje de Puntos',
        message: `${userData.name || userData.email} ha canjeado ${reward.title}.`,
        targetRoles: ['rh', 'ceo', 'superadmin'],
        tenantId: userData.tenantId,
        readBy: [],
        createdAt: serverTimestamp(),
      });

      toast.success(`¡Canje exitoso! Solicitud enviada para: ${reward.title}`);
    } catch (error) {
      console.error("Error redeeming reward:", error);
      toast.error("Error al procesar el canje.");
    } finally {
      setRedeemingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <Loader2 className="w-8 h-8 text-secondary animate-spin" />
        <p className="text-primary/40 font-bold uppercase tracking-widest text-[10px]">Cargando Recompensas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
        <button 
          onClick={() => setActiveTab('store')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
            activeTab === 'store' ? "bg-secondary text-on-secondary shadow-lg" : "text-primary/40"
          )}
        >
          Tienda de Premios
        </button>
        <button 
          onClick={() => setActiveTab('feed')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
            activeTab === 'feed' ? "bg-secondary text-on-secondary shadow-lg" : "text-primary/40"
          )}
        >
          Muro Social
        </button>
      </div>

      {activeTab === 'feed' ? (
        <SocialFeed userData={userData} />
      ) : (
        <>
          <section className="text-center space-y-2">
            <h1 className="text-3xl font-black font-headline text-white tracking-tight uppercase">Centro Elite</h1>
            <p className="text-sm text-primary/60 font-medium tracking-tight">Gamificación y Reconocimiento IA</p>
          </section>

          {/* Leaderboard Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Ranking del Mes (Top 3)</h3>
              <Trophy className="w-4 h-4 text-tertiary" />
            </div>
            
            <div className="grid grid-cols-3 gap-3 items-end h-40">
              {/* Silver (2nd) */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl border-2 border-primary/20 overflow-hidden bg-surface-container shadow-xl">
                    <img src={leaderboard[1]?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=2`} alt="2nd" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-300 rounded-full flex items-center justify-center text-[10px] font-black text-black border-2 border-background">2</div>
                </div>
                <div className="w-full h-16 bg-white/5 rounded-t-xl flex flex-col items-center justify-center p-1 border-x border-t border-white/5 transition-all group-hover:h-20 group-hover:bg-white/10">
                  <span className="text-[8px] font-black text-white/60 uppercase truncate w-full text-center">{leaderboard[1]?.name?.split(' ')[0] || "---"}</span>
                  <span className="text-[10px] font-bold text-secondary">{leaderboard[1]?.points.toLocaleString() || 0}</span>
                </div>
              </div>

              {/* Gold (1st) */}
              <div className="flex flex-col items-center gap-2 group scale-110">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl border-4 border-tertiary overflow-hidden bg-surface-container shadow-2xl">
                    <img src={leaderboard[0]?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=1`} alt="1st" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-tertiary rounded-full flex items-center justify-center text-xs font-black text-black border-4 border-background animate-bounce">1</div>
                </div>
                <div className="w-full h-24 bg-gradient-to-t from-tertiary/20 to-tertiary/10 rounded-t-2xl flex flex-col items-center justify-center p-1 border-x border-t border-tertiary/30 transition-all group-hover:h-28">
                  <span className="text-[9px] font-black text-tertiary uppercase truncate w-full text-center">{leaderboard[0]?.name?.split(' ')[0] || "---"}</span>
                  <span className="text-sm font-black text-white">{leaderboard[0]?.points.toLocaleString() || 0}</span>
                </div>
              </div>

              {/* Bronze (3rd) */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl border-2 border-primary/20 overflow-hidden bg-surface-container shadow-xl">
                    <img src={leaderboard[2]?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=3`} alt="3rd" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center text-[10px] font-black text-black border-2 border-background">3</div>
                </div>
                <div className="w-full h-12 bg-white/5 rounded-t-xl flex flex-col items-center justify-center p-1 border-x border-t border-white/5 transition-all group-hover:h-16 group-hover:bg-white/10">
                  <span className="text-[8px] font-black text-white/60 uppercase truncate w-full text-center">{leaderboard[2]?.name?.split(' ')[0] || "---"}</span>
                  <span className="text-[10px] font-bold text-secondary">{leaderboard[2]?.points.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="glass-panel p-6 rounded-3xl flex items-center justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-primary/40 uppercase tracking-widest">Tu Saldo Disponible</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black font-headline text-white">{userData.points?.toLocaleString() || 0}</span>
                <span className="text-sm font-bold text-secondary uppercase tracking-widest">Pts</span>
              </div>
            </div>
            <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center border border-secondary/40 shadow-[0_0_20px_rgba(68,221,194,0.2)]">
              <Star className="w-8 h-8 text-secondary fill-secondary animate-pulse" />
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-bold text-primary/40 uppercase tracking-[0.2em]">Premios en Almacén</h3>
              <span className="text-[10px] text-primary/60 bg-white/5 px-2 py-1 rounded-lg border border-white/5 uppercase font-bold">{rewards.length} Ítems</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {rewards.map((item) => {
                const canAfford = (userData.points || 0) >= item.pts;
                return (
                  <div key={item.id} className={cn(
                    "glass-panel rounded-3xl overflow-hidden group border transition-all duration-300",
                    canAfford ? "border-white/5 hover:border-secondary/40" : "border-white/5 opacity-80"
                  )}>
                    <div className="aspect-[4/3] relative overflow-hidden">
                      <img 
                        src={item.img} 
                        alt={item.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        referrerPolicy="no-referrer" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                      <div className="absolute top-3 right-3 bg-secondary/90 backdrop-blur-md px-2 py-1 rounded-lg border border-secondary/40">
                        <p className="text-[10px] font-black text-on-secondary">{item.pts.toLocaleString()} PTS</p>
                      </div>
                    </div>
                    
                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight line-clamp-1">{item.title}</h4>
                        <p className="text-[9px] text-primary/40 font-bold uppercase tracking-tighter line-clamp-2 mt-1">
                          {item.description || "Canje exclusivo verificado por IA."}
                        </p>
                      </div>
                      
                      <button 
                        onClick={() => handleRedeem(item)}
                        disabled={!canAfford || redeemingId === item.id}
                        className={cn(
                          "w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                          canAfford 
                            ? "bg-secondary text-on-secondary shadow-lg hover:brightness-110 active:scale-95" 
                            : "bg-white/5 text-primary/20 border border-white/5 cursor-not-allowed"
                        )}
                      >
                        {redeemingId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            {canAfford ? "Canjear" : "Faltan Puntos"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-panel p-5 rounded-3xl border border-dashed border-primary/20 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-tight">Provisión de Premio</p>
              <p className="text-[10px] text-primary/60 font-medium">Sincronización directa con RH para activación de recompensas.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
