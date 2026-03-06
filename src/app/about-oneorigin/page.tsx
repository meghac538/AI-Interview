"use client";

import Link from "next/link";
import { ArrowRight, Building2, Sparkles, MapPin, Layers3 } from "lucide-react";
import { BentoGridBlock } from "@/components/uitripled/bento-grid-block-shadcnui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AboutOneOriginPage() {
  return (
    <main className="surface-grid min-h-screen">
      <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-12 md:px-8 md:pb-14 md:pt-16">
        <div className="space-y-6">
          <Badge
            variant="outline"
            className="w-fit border-border/60 bg-background/60 backdrop-blur"
          >
            About OneOrigin Inc.
          </Badge>

          <div className="space-y-4">
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
              Innovate to Build. Impact to Elevate. Inspire to Empower.
            </h1>
            <p className="max-w-4xl text-pretty text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
              OneOrigin is an AI-native company focused on digital
              transformation in education and beyond. We build adaptive AI
              systems, precision engineering, and immersive experiences that
              help institutions move faster, operate cleaner, and serve learners
              with more clarity and confidence.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="rounded-2xl">
              <Link href="/candidate/login">
                Candidate Login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-2xl">
              <Link href="/admin">
                <Building2 className="h-4 w-4" />
                Admin
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-2xl">
              <a
                href="https://www.oneorigin.us/"
                target="_blank"
                rel="noreferrer"
              >
                Website
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Card className="glass-surface rounded-[24px] border-0">
            <CardHeader className="space-y-2">
              <CardDescription className="uppercase tracking-[0.2em]">
                What we build
              </CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="h-5 w-5 text-primary" />
                AI engines that adapt
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              Systems that automate workflows, analyze signals in real time, and
              keep learning. Built to integrate cleanly, preserve governance,
              and ship value fast.
            </CardContent>
          </Card>

          <Card className="glass-surface rounded-[24px] border-0">
            <CardHeader className="space-y-2">
              <CardDescription className="uppercase tracking-[0.2em]">
                How we deliver
              </CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Layers3 className="h-5 w-5 text-primary" />
                Engineering. Perfected.
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              Performance, security, and scalability first. From platform
              architecture to integrations, we build systems that hold up under
              real-world constraints.
            </CardContent>
          </Card>

          <Card className="glass-surface rounded-[24px] border-0">
            <CardHeader className="space-y-2">
              <CardDescription className="uppercase tracking-[0.2em]">
                Where we operate
              </CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <MapPin className="h-5 w-5 text-primary" />
                Global footprint
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              Headquarters in Scottsdale, Arizona, with teams across the Middle
              East and India. Built for cross-timezone execution without the
              overhead.
            </CardContent>
          </Card>
        </div>
      </section>

      <BentoGridBlock />
    </main>
  );
}
