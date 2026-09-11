'use client'

import type { ReactNode } from "react"
import {
  BarChart,
  Bot,
  Database,
  Globe,
  MonitorSmartphone,
  Workflow
} from "lucide-react"

import {
  OrbitingSkills,
  type OrbitSkillItem,
} from "../../components/unlumen-ui/orbiting-skills"
import Image from "next/image"

const ICON_SKILLS: OrbitSkillItem[] = [
  { label: "AI Models", icon: <Bot className="size-4" /> },
  { label: "Analytics", icon: <BarChart className="size-4" /> },
  { label: "Databases", icon: <Database className="size-4" /> },
  { label: "Frontend", icon: <MonitorSmartphone className="size-4" /> },
  { label: "Automations", icon: <Workflow className="size-4" /> },
  { label: "Global Edge", icon: <Globe className="size-4" /> },
]

function Avatar({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-[88px] h-[88px] items-center justify-center rounded-full border border-[var(--line)] bg-[#ffffff] shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
      {children}
    </div>
  )
}

export function OrbitingIntegrations() {
  return (
    <div className="orbit-wrapper flex min-h-[400px] flex-wrap items-center justify-center gap-24 p-8">
      <div className="flex flex-col items-center gap-4">
        <OrbitingSkills
          items={ICON_SKILLS}
          radius={120}
          duration={20}
          showPath={true}
          followCursor={false}
        >
          <Avatar>
            <div className="text-[var(--ember)] font-bold text-2xl tracking-tighter flex items-center justify-center" style={{ fontFamily: 'var(--display)' }}>
              us<span className="text-[var(--ink)]">.io</span>
            </div>
          </Avatar>
        </OrbitingSkills>
      </div>
    </div>
  )
}
