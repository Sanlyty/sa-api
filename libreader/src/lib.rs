use std::convert::TryInto;

use js_sys::Array;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

fn parse_i32_raw(data: &[u8]) -> i32 {
    i32::from_le_bytes(data.try_into().unwrap())
}

fn parse_i32(data: &[u8]) -> f64 {
    parse_i32_raw(data) as f64
}

fn parse_f32(data: &[u8]) -> f64 {
    f32::from_le_bytes(data.try_into().unwrap()) as f64
}

#[wasm_bindgen]
pub fn load_data(data: &[u8], y_type: &str, variants: JsValue) -> Vec<Array> {
    let variants: Vec<String> = serde_wasm_bindgen::from_value(variants).unwrap();
    let row_obj_count = variants.len() + 1;
    let row_len = variants.len() * 4 + 4;

    let mut rows: Vec<Array> = Vec::with_capacity(data.len() / row_len);

    let parser = match y_type {
        "F32" => parse_f32,
        "I32" => parse_i32,
        _ => panic!("Unsupported y type"),
    };

    for row in data.chunks_exact(row_len) {
        let rs: Array = Array::new_with_length(row_obj_count as u32);

        rs.set(0, JsValue::from(parse_i32_raw(&row[0..4])));
        row.chunks_exact(4)
            .skip(1)
            .enumerate()
            .for_each(|(i, val)| {
                rs.set(1 + i as u32, JsValue::from_f64(parser(val)));
            });

        rows.push(rs);
    }

    rows
}
