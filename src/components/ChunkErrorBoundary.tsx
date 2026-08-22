import { Component, ReactNode } from "react";
import {
  isStaleChunkError,
  canReload,
  clearReloadFlag,
} from "@/utils/lazyWithReload";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Ловит ошибку загрузки страницы после обновления сайта.
 * Файл со старым именем уже удалён с сервера — молча перезагружаем страницу,
 * как это делает пользователь через F5. Если не помогло, показываем кнопку.
 */
class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidMount(): void {
    // Страница открылась нормально — цепочка прервана
    clearReloadFlag();
  }

  componentDidCatch(error: unknown): void {
    if (isStaleChunkError(error) && canReload()) {
      window.location.reload();
      return;
    }
    console.error("Ошибка загрузки страницы:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        {this.props.fallback}
        <p className="text-muted-foreground max-w-sm">
          Не удалось загрузить страницу. Обычно помогает обновление.
        </p>
        <button
          onClick={() => {
            clearReloadFlag();
            window.location.reload();
          }}
          className="rounded-md bg-primary px-5 py-2 text-primary-foreground"
        >
          Обновить страницу
        </button>
      </div>
    );
  }
}

export default ChunkErrorBoundary;