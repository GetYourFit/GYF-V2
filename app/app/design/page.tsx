"use client";

// Living style guide — renders every design-system primitive in one place so the
// Editorial Gallery language can be reviewed at a glance and primitives stay in
// lockstep. Self-contained (mounts its own ToastProvider); no app nav chrome.

import { Bookmark, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonGrid } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { ToastProvider, useToast } from "@/components/ui/toast";

const SELECT_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "festive", label: "Festive" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-border py-10 first:border-t-0">
      <h2 className="t-label text-text-faint">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function Gallery() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState("upload");
  const [switchOn, setSwitchOn] = useState(true);

  return (
    <div className="mx-auto w-full max-w-screen-md px-5 py-12 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-col gap-2">
        <p className="t-label text-text-faint">Design system</p>
        <div className="mt-1 h-px w-16 bg-accent-warm" aria-hidden />
        <h1 className="t-display text-text">Editorial Noir</h1>
        <p className="t-body max-w-prose text-text-mid">
          Every primitive, one canvas. Near-black ground, warm ivory ink, hairline rules; antique
          gold reserved for confidence and editorial accents.
        </p>
      </header>

      <Section title="Typography">
        <div className="flex flex-col gap-3">
          <p className="t-display text-text">Display — the masthead voice</p>
          <p className="t-headline text-text">Headline — section titles</p>
          <p className="t-title text-text">Title — card and group headings</p>
          <p className="t-body text-text">
            Body — the reading size for descriptions and stylist copy that needs to breathe.
          </p>
          <p className="t-editorial text-text">
            Editorial — serif italic for stylist explanations and pull-quotes.
          </p>
          <p className="t-caption">Caption — supporting muted copy.</p>
          <p className="t-label text-text-faint">Label — uppercase eyebrow</p>
          <p className="t-mono text-text-mid">Mono — 92% match · metadata</p>
        </div>
      </Section>

      <Section title="Buttons">
        <Row>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </Row>
        <Row>
          <Button size="sm">
            <Plus size={14} /> Small
          </Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
      </Section>

      <Section title="Badges">
        <Row>
          <Badge>Casual</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="confidence">
            <span className="h-1 w-1 rounded-full bg-accent-warm" aria-hidden /> 92% match
          </Badge>
        </Row>
      </Section>

      <Section title="Avatars">
        <Row>
          <Avatar name="Ada Lovelace" size="sm" />
          <Avatar name="Grace Hopper" size="md" />
          <Avatar name="Katherine Johnson" size="lg" />
          <Avatar name="With Image" src="https://i.pravatar.cc/96" size="lg" />
        </Row>
      </Section>

      <Section title="Form controls">
        <div className="flex max-w-sm flex-col gap-5">
          <Field label="Email" hint="We never share it.">
            {(p) => <Input type="email" placeholder="you@example.com" {...p} />}
          </Field>
          <Field label="Password" error="Must be at least 8 characters.">
            {(p) => <Input type="password" {...p} />}
          </Field>
          <Field label="Occasion">
            {(p) => <Select options={SELECT_OPTIONS} placeholder="Choose one" {...p} />}
          </Field>
          <div className="flex items-center justify-between gap-4">
            <span className="t-body text-text">Learn from my activity</span>
            <Switch checked={switchOn} onChange={setSwitchOn} aria-label="Learn from my activity" />
          </div>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <p className="t-title text-text">Static card</p>
              <Badge variant="confidence">88%</Badge>
            </CardHeader>
            <CardBody>
              <p className="t-body text-text-mid">A bordered surface for grouped content.</p>
            </CardBody>
            <CardFooter>
              <Button size="sm" variant="secondary">
                <Bookmark size={14} /> Save
              </Button>
            </CardFooter>
          </Card>
          <Card interactive>
            <CardBody>
              <p className="t-title text-text">Interactive card</p>
              <p className="t-body mt-1 text-text-mid">Hover for the lift affordance.</p>
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs value={tab} onValueChange={setTab}>
          <TabList label="Demo tabs">
            <Tab value="upload">Upload</Tab>
            <Tab value="url">From URL</Tab>
            <Tab value="library">Library</Tab>
          </TabList>
          <div className="py-4">
            <TabPanel value="upload">
              <p className="t-body text-text-mid">Upload panel — drop a photo here.</p>
            </TabPanel>
            <TabPanel value="url">
              <p className="t-body text-text-mid">URL panel — paste a product link.</p>
            </TabPanel>
            <TabPanel value="library">
              <p className="t-body text-text-mid">Library panel — pick from your wardrobe.</p>
            </TabPanel>
          </div>
        </Tabs>
      </Section>

      <Section title="Overlays & feedback">
        <Row>
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: "Saved", description: "Added to your looks.", variant: "success" })}
          >
            Success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: "Something went wrong", variant: "error" })}
          >
            Error toast
          </Button>
        </Row>
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} titleId="demo-dialog-title">
          <div className="flex flex-col gap-4 p-6">
            <h2 id="demo-dialog-title" className="t-headline text-text">
              Dialog
            </h2>
            <p className="t-body text-text-mid">
              Focus-trapped, scroll-locked, Escape-to-close. Bottom sheet on mobile, centered on
              desktop.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
            </div>
          </div>
        </Dialog>
      </Section>

      <Section title="Loading & empty states">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64" />
            <SkeletonGrid count={3} className="max-w-md" />
          </div>
          <Card>
            <EmptyState
              icon={Sparkles}
              title="No looks yet"
              description="Saved outfits will appear here once you start styling."
              action={<Button size="sm">Start styling</Button>}
            />
          </Card>
        </div>
      </Section>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <ToastProvider>
      <Gallery />
    </ToastProvider>
  );
}
