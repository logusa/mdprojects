import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const showNotification = (title: string, description?: string, onClick?: () => void) => {
  toast(title, {
    description,
    duration: 5000,
    action: onClick ? {
      label: 'Ver',
      onClick: onClick
    } : undefined
  });
};

export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId);
};