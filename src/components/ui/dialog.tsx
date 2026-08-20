import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

// True when the dialog is portalled into document.body (desktop / standalone),
// false when it is rendered inside the mobile phone frame.
const DialogViewportContext = React.createContext(false);

const DialogPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [container, setContainer] = React.useState<HTMLElement | null | undefined>(undefined);
  React.useEffect(() => {
    const el = document.querySelector(".mobile-phone-frame") as HTMLElement | null;
    // If .mobile-phone-frame exists, use it; otherwise use null (document.body)
    setContainer(el);
  }, []);
  
  // Wait for useEffect to run before rendering
  if (container === undefined) return null;
  
  // Pass null to use document.body (native/standalone), or the frame element (preview)
  return (
    <DialogPrimitive.Portal container={container || undefined}>
      <DialogViewportContext.Provider value={!container}>{children}</DialogViewportContext.Provider>
    </DialogPrimitive.Portal>
  );
};

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const isViewport = React.useContext(DialogViewportContext);
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        isViewport ? "fixed" : "absolute",
        "inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContentInner = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const isViewport = React.useContext(DialogViewportContext);
  return (
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className={cn(
        isViewport ? "fixed" : "absolute",
        "z-50 grid gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
        // Default to fullscreen if no positioning classes are passed
        className?.includes("left-1/2") || className?.includes("inset-0") ? "" : "inset-0 w-full h-full sm:rounded-none",
        isViewport ? "max-h-screen overflow-y-auto" : "",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  );
});
DialogContentInner.displayName = "DialogContentInner";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogContentInner ref={ref} {...props}>
      {children}
    </DialogContentInner>
  </DialogPortal>
));

DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-row justify-end space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
