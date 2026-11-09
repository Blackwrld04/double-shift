import {
  IconArrowRight,
  IconBuildingStore,
  IconCheck,
  IconClock,
  IconLayoutGrid,
  IconRefresh,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { useActionMutation } from "@agent-native/core/client/hooks";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/components/workspace/workspace-context";

export function VenueOnboardingModal() {
  const { workspace, openSetupModal, setOpenSetupModal, refresh } =
    useWorkspace();
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
  const switchVenueMutation = useActionMutation("switch-venue");

  if (!openSetupModal) return null;

  const canDismiss = workspace?.onboarded !== false;

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
      setOpenSetupModal(false);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to set up restaurant.");
    } finally {
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
      setOpenSetupModal(false);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to load demo dataset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToVenue = async (venueId: string) => {
    setIsSubmitting(true);
    try {
      await switchVenueMutation.mutateAsync({ venueId });
      await refresh();
      setOpenSetupModal(false);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to switch venue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-start justify-between bg-neutral-900/40">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-white text-black font-mono font-semibold text-xs">
                DS
              </span>
              <h2 className="text-lg font-semibold text-white tracking-tight">
                {canDismiss ? "Restaurant Settings & Switcher" : "Set Up Your Restaurant"}
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              Double Shift simulates floor pacing, kitchen bottlenecks, and table turns for your venue.
            </p>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={() => setOpenSetupModal(false)}
              className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors"
              aria-label="Close"
            >
              <IconX className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 p-1.5 mx-6 mt-4 bg-neutral-900 rounded-lg border border-neutral-800">
          <button
            type="button"
            onClick={() => {
              setTab("custom");
              setErrorMsg(null);
            }}
            className={`py-2 px-3 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
              tab === "custom"
                ? "bg-white text-black shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconBuildingStore className="w-4 h-4" />
            <span>Set Up My Restaurant</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("demo");
              setErrorMsg(null);
            }}
            className={`py-2 px-3 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
              tab === "demo"
                ? "bg-white text-black shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconLayoutGrid className="w-4 h-4" />
            <span>Explore with Sample Demo</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs text-neutral-200 bg-neutral-900 border border-neutral-700 rounded-lg">
              {errorMsg}
            </div>
          )}

          {tab === "custom" ? (
            <form onSubmit={handleLaunchCustom} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="restaurant-name" className="text-xs font-medium text-neutral-200">
                  Restaurant Name <span className="text-white">*</span>
                </Label>
                <Input
                  id="restaurant-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bella Cucina or The Riverfront Grill"
                  required
                  autoFocus
                  className="bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-neutral-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="restaurant-address" className="text-xs font-medium text-neutral-200">
                    Location / City
                  </Label>
                  <Input
                    id="restaurant-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. New York, NY"
                    className="bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-neutral-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shift-name" className="text-xs font-medium text-neutral-200">
                    Primary Service Shift
                  </Label>
                  <Input
                    id="shift-name"
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    placeholder="e.g. Friday Dinner Service"
                    className="bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-neutral-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shift-start" className="text-xs font-medium text-neutral-200">
                    Doors Open
                  </Label>
                  <Input
                    id="shift-start"
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="bg-neutral-900 border-neutral-800 text-white focus-visible:ring-neutral-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shift-end" className="text-xs font-medium text-neutral-200">
                    Last Seating
                  </Label>
                  <Input
                    id="shift-end"
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="bg-neutral-900 border-neutral-800 text-white focus-visible:ring-neutral-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="target-covers" className="text-xs font-medium text-neutral-200">
                    Expected Covers
                  </Label>
                  <Input
                    id="target-covers"
                    type="number"
                    min={10}
                    max={500}
                    value={targetCovers}
                    onChange={(e) => setTargetCovers(Number(e.target.value))}
                    className="bg-neutral-900 border-neutral-800 text-white focus-visible:ring-neutral-400"
                  />
                </div>
              </div>

              {/* Floor Layout Template Choice */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-medium text-neutral-200">Initial Floor Layout</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTemplate("bistro")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      template === "bistro"
                        ? "bg-neutral-900 border-white text-white"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white">Boutique Bistro</span>
                      {template === "bistro" && <IconCheck className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-tight">
                      8 starter tables (2-tops, 4-tops, 6-top), bar counter, and initial staff crew.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTemplate("blank")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      template === "blank"
                        ? "bg-neutral-900 border-white text-white"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-white">Blank Floor Plan</span>
                      {template === "blank" && <IconCheck className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-tight">
                      Empty dining room canvas with Kitchen Pass and Bar ready for custom placement.
                    </p>
                  </button>
                </div>
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="w-full bg-white text-black hover:bg-neutral-200 font-medium text-xs h-10 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Configuring Restaurant Twin…</span>
                  ) : (
                    <>
                      <span>Launch Restaurant Twin</span>
                      <IconArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-800 text-neutral-300 mb-1.5">
                      Sample Dataset
                    </span>
                    <h3 className="text-sm font-semibold text-white">Osteria Nove</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      9 Bank Street, New York, NY · Friday Dinner Service
                    </p>
                  </div>
                  <IconBuildingStore className="w-6 h-6 text-neutral-400" />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800 text-xs">
                  <div className="p-2 bg-neutral-950/80 rounded border border-neutral-800">
                    <span className="text-[10px] uppercase font-mono text-neutral-500 block">Tables</span>
                    <span className="font-semibold text-white">24 Tables</span>
                  </div>
                  <div className="p-2 bg-neutral-950/80 rounded border border-neutral-800">
                    <span className="text-[10px] uppercase font-mono text-neutral-500 block">Staff</span>
                    <span className="font-semibold text-white">13 Members</span>
                  </div>
                  <div className="p-2 bg-neutral-950/80 rounded border border-neutral-800">
                    <span className="text-[10px] uppercase font-mono text-neutral-500 block">Service</span>
                    <span className="font-semibold text-white">180 Covers</span>
                  </div>
                </div>

                <p className="text-xs text-neutral-400 pt-1">
                  Includes full dining room, patio, private dining room, bar, station loads, ticket times, and staged proposals.
                </p>

                <Button
                  type="button"
                  onClick={handleLaunchDemo}
                  disabled={isSubmitting}
                  className="w-full bg-white text-black hover:bg-neutral-200 font-medium text-xs h-10 rounded-md transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <span>Loading Sample Demo…</span>
                  ) : (
                    <>
                      <span>Explore Osteria Nove Sample</span>
                      <IconArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* If existing venues exist, list them for 1-click switching */}
              {workspace?.availableVenues && workspace.availableVenues.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
                    Available Venues In This Workspace
                  </h4>
                  <div className="space-y-1.5">
                    {workspace.availableVenues.map((v) => {
                      const isActive = v.id === workspace.venue.id;
                      return (
                        <div
                          key={v.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                            isActive
                              ? "bg-neutral-900 border-neutral-700 text-white"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          <span className="font-medium">{v.name}</span>
                          {isActive ? (
                            <span className="text-[10px] uppercase font-mono text-neutral-400 px-2 py-0.5 rounded bg-neutral-800">
                              Active
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSubmitting}
                              onClick={() => handleSwitchToVenue(v.id)}
                              className="h-7 text-xs border-neutral-700 hover:bg-neutral-800"
                            >
                              Switch to this
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

