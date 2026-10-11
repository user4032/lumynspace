"use client"

import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = props.value ?? props.defaultValue ?? [0]
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex w-full touch-none items-center select-none data-disabled:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-foreground/80" />
      </SliderPrimitive.Track>
      {values.map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-4 rounded-full border border-foreground/20 bg-background shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_4px_color-mix(in_oklab,var(--foreground)_6%,transparent)] transition-[box-shadow,transform] outline-none hover:scale-110 focus-visible:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_35%,transparent)] active:scale-95"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
