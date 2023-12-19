// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "accelerate")]
extern crate accelerate_src;

use anyhow::Result;
use candle_core::quantized::gguf_file;
use candle_core::{Device, Tensor};
use candle_examples::token_output_stream::TokenOutputStream;
use candle_transformers::generation::LogitsProcessor;
use candle_transformers::models::quantized_llama::ModelWeights;
use once_cell::sync::Lazy;
use std::path::PathBuf;
use std::sync::Mutex;
use tokenizers::{AddedToken, Tokenizer};

static MODEL: Lazy<Mutex<Option<ModelWeights>>> = Lazy::new(|| Mutex::new(None));
static TOKENIZER: Lazy<Mutex<Option<Tokenizer>>> = Lazy::new(|| Mutex::new(None));

const MODEL_PATH: &str =
    "/Users/anthonydemattos/netonomy/models/mistral/openhermes-2.5-mistral-7b-16k.Q4_K_M.gguf";
const TOKENIZER_REPO: &str = "mistralai/Mistral-7B-v0.1";
const MAX_TOKENS: usize = 1000;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    println!("Hello, {}!", name);
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command(async)]
fn generate(window: tauri::Window, prompt_str: &str) -> Result<(), ()> {
    println!("Generating...");
    let mut model_guard = MODEL.lock().unwrap();
    let model: &mut ModelWeights = model_guard.as_mut().expect("Model not loaded");
    // Get the tokenizer
    let tokenizer = TOKENIZER
        .lock()
        .unwrap()
        .clone()
        .expect("Tokenizer not loaded");

    let mut tos = TokenOutputStream::new(tokenizer);

    let pre_prompt_tokens: Vec<u32> = vec![];

    // Text generation logic
    let tokens = tos
        .tokenizer()
        .encode(prompt_str, true)
        .expect("Failed to encode prompt");
    let prompt_tokens = [&pre_prompt_tokens[..], tokens.get_ids()].concat();
    let to_sample = MAX_TOKENS.saturating_sub(1);

    let prompt_tokens = if prompt_tokens.len() + to_sample
        > candle_transformers::models::quantized_llama::MAX_SEQ_LEN - 10
    {
        let to_remove = prompt_tokens.len() + to_sample + 10
            - candle_transformers::models::quantized_llama::MAX_SEQ_LEN;
        prompt_tokens[prompt_tokens.len().saturating_sub(to_remove)..].to_vec()
    } else {
        prompt_tokens
    };

    let mut all_tokens: Vec<u32> = vec![];
    let mut logits_processor = LogitsProcessor::new(299792458_u64, Some(0.), None);

    // Generate inital token
    let next_token: u32 = {
        let input: Tensor = Tensor::new(prompt_tokens.as_slice(), &Device::Cpu)
            .expect("Failed to create input tensor")
            .unsqueeze(0)
            .expect("Failed to unsqueeze tensor");
        let logits = model.forward(&input, 0).expect("Failed to generate logits");
        let logits: Tensor = logits.squeeze(0).expect("Failed to squeeze logits tensor");
        logits_processor
            .sample(&logits)
            .expect("Failed to sample next token")
    };

    all_tokens.push(next_token);

    let eos_token: &str = "<|im_end|>";
    let eos_token: u32 = *tos.tokenizer().get_vocab(true).get(eos_token).unwrap();

    if let Some(t) = tos.next_token(next_token).expect("msg") {
        println!("{}", t);
        let _ = window.emit("token", Some(t)).map_err(|e| e.to_string());
    }

    // Token generation loop
    for index in 0..to_sample {
        let input: Tensor = Tensor::new(
            &[all_tokens.last().copied().unwrap_or_default()],
            &Device::Cpu,
        )
        .expect("msg")
        .unsqueeze(0)
        .expect("");
        let logits: Tensor = model
            .forward(&input, prompt_tokens.len() + index)
            .expect("msg");
        let logits: Tensor = logits.squeeze(0).expect("msg");

        let next_token = logits_processor.sample(&logits).expect("msg");
        all_tokens.push(next_token);

        if let Some(t) = tos.next_token(next_token).expect("msg") {
            println!("{}", t);
            let _ = window.emit("token", Some(t)).map_err(|e| e.to_string());
        }

        if next_token == eos_token {
            let _ = window.emit("token", Some("DONE"));
            break;
        }
    }

    // pre_prompt_tokens = [&prompt_tokens[..], &all_tokens[..]].concat();

    if let Some(rest) = tos.decode_rest().expect("msg") {
        println!("{}", rest);
    }

    Ok(())
}

fn load_model() -> Result<()> {
    let mut file = std::fs::File::open(&MODEL_PATH)?;
    let start = std::time::Instant::now();
    let model = gguf_file::Content::read(&mut file)?;
    let mut total_size_in_bytes = 0;
    for (_, tensor) in model.tensor_infos.iter() {
        let elem_count = tensor.shape.elem_count();
        total_size_in_bytes +=
            elem_count * tensor.ggml_dtype.type_size() / tensor.ggml_dtype.blck_size();
    }
    println!(
        "loaded {:?} tensors ({}) in {:.2}s",
        model.tensor_infos.len(),
        &format_size(total_size_in_bytes),
        start.elapsed().as_secs_f32(),
    );

    let model_weights =
        candle_transformers::models::quantized_llama::ModelWeights::from_gguf(model, &mut file);
    match model_weights {
        Ok(weights) => {
            let mut model = MODEL.lock().unwrap();
            *model = Some(weights);
        }
        Err(e) => {
            eprintln!("Failed to load model: {:?}", e);
            return Err(anyhow::Error::msg(e.to_string()));
        }
    }

    Ok(())
}

fn fetch_and_load_tokenizer(repo: &str) -> Result<()> {
    let api = hf_hub::api::sync::Api::new()?;
    let api = api.model(repo.to_string());
    let tokenizer_path: PathBuf = api.get("tokenizer.json")?;

    let mut tokenizer = Tokenizer::from_file(tokenizer_path).map_err(anyhow::Error::msg);
    tokenizer = match tokenizer {
        Ok(mut tokenizer) => {
            let special_tokens: &[AddedToken] = &[
                AddedToken {
                    content: "<|im_start|>".to_string(),
                    single_word: false,
                    lstrip: false,
                    rstrip: false,
                    normalized: false,
                    special: true,
                },
                AddedToken {
                    content: "<|im_end|>".to_string(),
                    single_word: false,
                    lstrip: false,
                    rstrip: false,
                    normalized: false,
                    special: true,
                },
                AddedToken {
                    content: "<unk>".to_string(),
                    single_word: false,
                    lstrip: false,
                    rstrip: false,
                    normalized: false,
                    special: true,
                },
            ];
            tokenizer.add_special_tokens(special_tokens);
            Ok(tokenizer)
        }
        Err(_) => Err(anyhow::Error::msg("Failed to fetch tokenizer")),
    };

    println!("Loaded tokenizer");

    let mut _tokenizer = TOKENIZER.lock().unwrap();
    *_tokenizer = Some(tokenizer.expect("Failed to set tokenizer"));

    Ok(())
}

fn format_size(size_in_bytes: usize) -> String {
    if size_in_bytes < 1_000 {
        format!("{}B", size_in_bytes)
    } else if size_in_bytes < 1_000_000 {
        format!("{:.2}KB", size_in_bytes as f64 / 1e3)
    } else if size_in_bytes < 1_000_000_000 {
        format!("{:.2}MB", size_in_bytes as f64 / 1e6)
    } else {
        format!("{:.2}GB", size_in_bytes as f64 / 1e9)
    }
}

fn main() {
    // Use hardware optimizations if available
    println!(
        "AVX: {}, NEON: {}, SIMD128: {}, F16C: {}",
        candle_core::utils::with_avx(),
        candle_core::utils::with_neon(),
        candle_core::utils::with_simd128(),
        candle_core::utils::with_f16c()
    );

    // Load the GGUF model
    let _ = load_model();

    println!("Loaded model");

    // Load the tokenizer
    fetch_and_load_tokenizer(TOKENIZER_REPO).expect("Tokenizer not loaded");

    println!("Loaded tokenizer");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, generate])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
