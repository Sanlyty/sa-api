cargo build --release --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/libreader.wasm --out-dir ./pkg --target nodejs