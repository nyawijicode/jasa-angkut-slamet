import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onRetry: () => void;
};

type State = {
  failed: boolean;
};

export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Peta gagal dimuat", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="map-loading is-error" role="status">
        <span>
          Peta tidak dapat dimuat. Anda masih bisa mencari alamat, memakai
          lokasi saya, atau mengetuk peta setelah memuat ulang.
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            this.setState({ failed: false });
            this.props.onRetry();
          }}
        >
          Coba muat ulang
        </button>
      </div>
    );
  }
}
