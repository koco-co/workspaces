import type { ReactNode } from "react";
import { Card } from "./Card";
import { Button } from "./Button";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <Card className="p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>x</Button>
        </div>
        {children}
      </Card>
    </div>
  );
}
