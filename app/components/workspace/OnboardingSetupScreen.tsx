import {
  IconArrowRight,
  IconBuildingStore,
  IconCheck,
  IconClock,
  IconFlame,
  IconLayoutGrid,
  IconUsers,
} from "@tabler/icons-react";
import { useState } from "react";
import { useActionMutation } from "@agent-native/core/client/hooks";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/components/workspace/workspace-context";

export function OnboardingSetupScreen() {
  const { refresh } = useWorkspace();
  const [tab, setTab] = useState<"custom" | "demo">("custom");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [shiftName, setShiftName] = useState("Dinner Service");
  const [shiftStart, setShiftStart] = useState("17:00");
  const [shiftEnd, setShiftEnd] = useState("22:30");
  const [targetCovers, setTargetCovers] = useState(80);
  const [template, setTemplate] = useState<"bistro" | "blank">("bistro");

  const setupVenueMutation = useActionMutation("setup-venue");

  const handleLaunchCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter your restaurant name.");
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await setupVenueMutation.mutateAsync({
        mode: "custom",
        name: name.trim(),
        address: address.trim() || undefined,
        shiftName: shiftName.trim() || "Dinner Service",
        shiftStart,
        shiftEnd,
        targetCovers: Number(targetCovers) || 80,
        template,
      });
      await refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to set up restaurant.");
      setIsSubmitting(false);
    }
  };

  const handleLaunchDemo = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await setupVenueMutation.mutateAsync({
        mode: "demo",
      });
      await refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load demo dataset.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl">
        {/* Double Shift Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-lg shadow-white/10 relative">
            <span className="absolute left-2 top-2 bottom-2 w-1.5 rounded-sm bg-[#09090b]"></span>
            <span className="absolute left-5 top-2 bottom-2 w-1.5 rounded-sm bg-[#09090b]/60"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white">Double Shift</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                Setup
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">Restaurant Operations Twin & Simulation</p>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-[#111114] border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1.5">
              Set up your restaurant
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Double Shift builds an operations twin of your dining floor and kitchen. Enter your restaurant details to model real table turns, bottlenecks, and staffing.
            </p>
          </div>

          {/* Segmented Mode Selector */}
          <div className="grid grid-cols-2 p-1 bg-neutral-900/90 rounded-xl border border-neutral-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setTab("custom");
                setErrorMsg(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                tab === "custom"
                  ? "bg-white text-black shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconBuildingStore className="w-4 h-4" />
              <span>Create Restaurant</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("demo");
                setErrorMsg(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                tab === "demo"
                  ? "bg-white text-black shadow-md"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconLayoutGrid className="w-4 h-4" />
              <span>Explore Demo</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl">
              {errorMsg}
            </div>
          )}

          {tab === "custom" ? (
            <form onSubmit={handleLaunchCustom} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="restaurant-name" className="text-xs font-medium text-neutral-300">
                  Restaurant Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="restaurant-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Trattoria Lucca or The Riverfront Grill"
                  required
                  autoFocus
                  className="bg-neutral-900/90 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-neutral-400 h-10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="restaurant-address" className="text-xs font-medium text-neutral-300">
                    Location / City
                  </Label>
                  <Input
                    id="restaurant-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. New York, NY"
                    className="bg-neutral-900/90 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-neutral-400 h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shift-name" className="text-xs font-medium text-neutral-300">
                    Primary Service Shift
                  </Label>
                  <Input
                    id="shift-name"
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    placeholder="e.g. Friday Dinner Service"
                    className="bg-neutral-900/90 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-neutral-400 h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shift-start" className="text-xs font-medium text-neutral-300">
                    Doors Open
                  </Label>
                  <Input
                    id="shift-start"
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="bg-neutral-900/90 border-neutral-800 text-white focus-visible:ring-neutral-400 h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shift-end" className="text-xs font-medium text-neutral-300">
                    Last Seating
                  </Label>
                  <Input
                    id="shift-end"
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="bg-neutral-900/90 border-neutral-800 text-white focus-visible:ring-neutral-400 h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="target-covers" className="text-xs font-medium text-neutral-300">
                    Target Covers
                  </Label>
                  <Input
                    id="target-covers"
                    type="number"
                    min={10}
                    max={500}
                    value={targetCovers}
                    onChange={(e) => setTargetCovers(Number(e.target.value))}
                    className="bg-neutral-900/90 border-neutral-800 text-white focus-visible:ring-neutral-400 h-10"
                  />
                </div>
              </div>

              {/* Floor Layout Template Choice */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs font-medium text-neutral-300">Starter Dining Floor</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTemplate("bistro")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      template === "bistro"
                        ? "bg-neutral-900 border-white text-white shadow-sm"
                        : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white">Boutique Bistro</span>
                      {template === "bistro" && <IconCheck className="w-4 h-4 text-white" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-normal">
                      8 starter tables (2-tops, 4-tops, 6-top), bar counter, and initial kitchen pass crew.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTemplate("blank")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      template === "blank"
                        ? "bg-neutral-900 border-white text-white shadow-sm"
                        : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white">Blank Floor Plan</span>
                      {template === "blank" && <IconCheck className="w-4 h-4 text-white" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-normal">
                      Empty dining room canvas with Kitchen Pass and Bar ready for customized layout.
                    </p>
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="w-full bg-white text-black hover:bg-neutral-200 font-semibold text-xs h-11 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10"
                >
                  {isSubmitting ? (
                    <span>Creating Restaurant Operations Twin…</span>
                  ) : (
                    <>
                      <span>Launch Restaurant Operations Twin</span>
                      <IconArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-800 text-neutral-300 mb-1.5">
                      Sample Dataset
                    </span>
                    <h3 className="text-sm font-semibold text-white">Osteria Nove Sample</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      9 Bank Street, New York, NY · Friday Dinner Service
                    </p>
                  </div>
                  <IconBuildingStore className="w-6 h-6 text-neutral-400" />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800 text-xs">
                  <div className="p-2.5 bg-neutral-950/80 rounded-lg border border-neutral-800/80">
                    <span className="text-[10px] uppercase font-mono text-neutral-500 block flex items-center gap-1">
                      <IconLayoutGrid size={11} /> Tables
                    </span>
                    <span className="font-semibold text-white mt-0.5 block">24 Tables</span>
                  </div>
                  <div className="p-2.5 bg-neutral-950/80 rounded-lg border border-neutral-800/80">
                    <span className="text-[10px] uppercase font-mono text-neutral-500 block flex items-center gap-1">
                      <IconUsers size={11} /> Staff
                    </span>
                    <span className="font-semibold text-white mt-0.5 block">13 Members</span>
                  </div>
                  <div className="p-2.5 bg-neutral-950/80 rounded-lg border border-neutral-800/80">
                    <span className="text-[10px] uppercase font-mono text-neutral-500 block flex items-center gap-1">
                      <IconFlame size={11} /> Covers
                    </span>
                    <span className="font-semibold text-white mt-0.5 block">180 Covers</span>
                  </div>
                </div>

                <p className="text-xs text-neutral-400 pt-1 leading-relaxed">
                  Includes full dining room, patio, private room, bar station loads, kitchen ticket times, and staged what-if proposals.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleLaunchDemo}
                disabled={isSubmitting}
                className="w-full bg-white text-black hover:bg-neutral-200 font-semibold text-xs h-11 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10"
              >
                {isSubmitting ? (
                  <span>Loading Osteria Nove Demo…</span>
                ) : (
                  <>
                    <span>Explore Osteria Nove Sample</span>
                    <IconArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

