export class Toast {
  static info(msg: string) {
    this.show(msg, "info");
  }

  static success(msg: string) {
    this.show(msg, "success");
  }

  static error(msg: string) {
    this.show(msg, "error");
  }

  private static show(msg: string, type: "info" | "success" | "error") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast-message ${type}`;
    toast.textContent = msg;

    container.appendChild(toast);

    // Fade out after 2.5 seconds
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => {
        toast.remove();
      }, 500);
    }, 2500);
  }
}

export const toast = Toast;
