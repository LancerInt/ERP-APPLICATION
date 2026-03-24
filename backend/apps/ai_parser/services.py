"""AI Parser Business Logic Services"""
import logging
import json
import time
import re
from decimal import Decimal
from io import BytesIO
from typing import Dict, List, Tuple, Optional

logger = logging.getLogger(__name__)

# LLM Prompt Templates
CUSTOMER_PO_PROMPT = """Extract the following from this purchase order text:
- PO Number: The unique purchase order identifier
- PO Date: The date the PO was issued (format: YYYY-MM-DD)
- Customer Name: The name of the customer/buyer
- Shipping Address: Complete shipping address
- Line items: Array with objects containing:
  * product_description: Description of the product/service
  * quantity: Quantity ordered
  * uom: Unit of measure (e.g., units, kg, etc.)
  * unit_price: Price per unit

Return as valid JSON with confidence scores (0-1) per field indicating extraction confidence.
Structure:
{
  "po_number": {"value": "...", "confidence": 0.95},
  "po_date": {"value": "YYYY-MM-DD", "confidence": 0.90},
  "customer_name": {"value": "...", "confidence": 0.95},
  "shipping_address": {"value": "...", "confidence": 0.85},
  "line_items": [
    {
      "product_description": {"value": "...", "confidence": 0.92},
      "quantity": {"value": 10, "confidence": 0.95},
      "uom": {"value": "units", "confidence": 0.90},
      "unit_price": {"value": 100.00, "confidence": 0.88}
    }
  ],
  "overall_confidence": 0.91
}"""

BANK_STATEMENT_PROMPT = """Extract transaction data from this bank statement text:
- Statement Period: From and to dates
- Account Number: The bank account number (masked)
- Transactions: Array of transactions with:
  * date: Transaction date (YYYY-MM-DD)
  * description: Transaction description
  * debit_amount: Amount debited (if any)
  * credit_amount: Amount credited (if any)
  * balance: Running balance after transaction
  * reference: Transaction reference/check number if available

Return as valid JSON with confidence scores per field.
Structure:
{
  "account_number": {"value": "****1234", "confidence": 0.95},
  "period_start": {"value": "YYYY-MM-DD", "confidence": 0.90},
  "period_end": {"value": "YYYY-MM-DD", "confidence": 0.90},
  "transactions": [
    {
      "date": {"value": "YYYY-MM-DD", "confidence": 0.95},
      "description": {"value": "...", "confidence": 0.85},
      "debit_amount": {"value": 500.00, "confidence": 0.90},
      "credit_amount": {"value": null, "confidence": 0.90},
      "balance": {"value": 10000.00, "confidence": 0.92},
      "reference": {"value": "REF123", "confidence": 0.88}
    }
  ],
  "overall_confidence": 0.90
}"""

INVOICE_PROMPT = """Extract the following from this invoice text:
- Invoice Number: Unique invoice identifier
- Invoice Date: Date of invoice (YYYY-MM-DD)
- Vendor Name: Name of the vendor/supplier
- Vendor Address: Address of vendor
- Bill To: Customer billing address
- Line Items: Array with product/service details including description, quantity, price
- Subtotal: Amount before tax
- Tax Amount: Tax applied
- Total Amount: Final invoice amount
- Payment Terms: Payment due date or terms
- Purchase Order Reference: Any PO reference number

Return as valid JSON with confidence scores per field.
Structure:
{
  "invoice_number": {"value": "INV-001", "confidence": 0.95},
  "invoice_date": {"value": "YYYY-MM-DD", "confidence": 0.92},
  "vendor_name": {"value": "...", "confidence": 0.95},
  "vendor_address": {"value": "...", "confidence": 0.85},
  "bill_to": {"value": "...", "confidence": 0.90},
  "line_items": [
    {
      "description": {"value": "...", "confidence": 0.90},
      "quantity": {"value": 5, "confidence": 0.95},
      "unit_price": {"value": 100.00, "confidence": 0.92},
      "total": {"value": 500.00, "confidence": 0.92}
    }
  ],
  "subtotal": {"value": 5000.00, "confidence": 0.93},
  "tax_amount": {"value": 500.00, "confidence": 0.88},
  "total_amount": {"value": 5500.00, "confidence": 0.94},
  "payment_terms": {"value": "Due in 30 days", "confidence": 0.80},
  "po_reference": {"value": "PO-123", "confidence": 0.85},
  "overall_confidence": 0.90
}"""


class OCRService:
    """Optical Character Recognition"""

    @staticmethod
    def run_ocr(file_path: str) -> Tuple[str, bool, str]:
        """
        Run OCR on PDF or image file using Tesseract.

        Args:
            file_path: Path to PDF or image file

        Returns:
            Tuple of (ocr_text, success, error_message)
        """
        try:
            import pytesseract
            from PIL import Image
            import PyPDF2

            text = ""
            error = ""

            if file_path.lower().endswith('.pdf'):
                # Extract text from PDF
                try:
                    with open(file_path, 'rb') as file:
                        pdf_reader = PyPDF2.PdfReader(file)
                        for page in pdf_reader.pages:
                            text += page.extract_text()
                except Exception as e:
                    logger.warning(f"PDF text extraction failed: {e}, falling back to image OCR")
                    # Fall back to image-based OCR if PDF parsing fails
                    pass

            if not text:  # If no text extracted or not a PDF
                # Try image OCR
                try:
                    image = Image.open(file_path)
                    text = pytesseract.image_to_string(image)
                except Exception as e:
                    return "", False, f"Image OCR failed: {str(e)}"

            if not text.strip():
                return "", False, "No text could be extracted from document"

            logger.info(f"OCR completed: {len(text)} characters extracted")
            return text, True, ""

        except ImportError:
            logger.error("Required OCR dependencies not installed")
            return "", False, "Tesseract or PDF libraries not installed"
        except Exception as e:
            logger.error(f"OCR error: {str(e)}")
            return "", False, str(e)


class LLMService:
    """Large Language Model Integration"""

    @staticmethod
    def parse_with_llm(ocr_text: str, provider: str, model: str, prompt: str) -> Tuple[Dict, Decimal, str]:
        """
        Send OCR text to LLM for structured extraction.

        Args:
            ocr_text: Raw OCR text
            provider: LLM provider (OLLAMA, GEMINI, OPENAI, ANTHROPIC)
            model: Model name
            prompt: Prompt template

        Returns:
            Tuple of (parsed_json, confidence_score, error_message)
        """
        full_prompt = f"{prompt}\n\nDocument text:\n{ocr_text}"

        try:
            if provider == 'OLLAMA':
                return LLMService._call_ollama(full_prompt, model)
            elif provider == 'GEMINI':
                return LLMService._call_gemini(full_prompt, model)
            elif provider == 'OPENAI':
                return LLMService._call_openai(full_prompt, model)
            elif provider == 'ANTHROPIC':
                return LLMService._call_anthropic(full_prompt, model)
            else:
                return {}, Decimal('0'), f"Unknown provider: {provider}"

        except Exception as e:
            logger.error(f"LLM parsing error: {str(e)}")
            return {}, Decimal('0'), str(e)

    @staticmethod
    def _call_ollama(prompt: str, model: str) -> Tuple[Dict, Decimal, str]:
        """Call Ollama API"""
        try:
            import requests

            response = requests.post(
                'http://localhost:11434/api/generate',
                json={'model': model, 'prompt': prompt, 'stream': False},
                timeout=60
            )

            if response.status_code != 200:
                return {}, Decimal('0'), f"Ollama error: {response.status_code}"

            result = response.json()
            response_text = result.get('response', '')

            # Extract JSON from response
            parsed = LLMService._extract_json_from_text(response_text)
            overall_confidence = parsed.get('overall_confidence', Decimal('0.7'))

            return parsed, Decimal(str(overall_confidence)), ""

        except Exception as e:
            return {}, Decimal('0'), f"Ollama call failed: {str(e)}"

    @staticmethod
    def _call_gemini(prompt: str, model: str) -> Tuple[Dict, Decimal, str]:
        """Call Google Gemini API"""
        try:
            import google.generativeai as genai

            genai.configure(api_key=__import__('os').environ.get('GEMINI_API_KEY'))
            client = genai.GenerativeModel(model)
            response = client.generate_content(prompt)
            response_text = response.text

            parsed = LLMService._extract_json_from_text(response_text)
            overall_confidence = parsed.get('overall_confidence', Decimal('0.7'))

            return parsed, Decimal(str(overall_confidence)), ""

        except Exception as e:
            return {}, Decimal('0'), f"Gemini call failed: {str(e)}"

    @staticmethod
    def _call_openai(prompt: str, model: str) -> Tuple[Dict, Decimal, str]:
        """Call OpenAI API"""
        try:
            from openai import OpenAI

            client = OpenAI()
            response = client.chat.completions.create(
                model=model,
                messages=[{'role': 'user', 'content': prompt}],
                temperature=0
            )

            response_text = response.choices[0].message.content
            parsed = LLMService._extract_json_from_text(response_text)
            overall_confidence = parsed.get('overall_confidence', Decimal('0.7'))

            return parsed, Decimal(str(overall_confidence)), ""

        except Exception as e:
            return {}, Decimal('0'), f"OpenAI call failed: {str(e)}"

    @staticmethod
    def _call_anthropic(prompt: str, model: str) -> Tuple[Dict, Decimal, str]:
        """Call Anthropic Claude API"""
        try:
            import anthropic

            client = anthropic.Anthropic()
            response = client.messages.create(
                model=model,
                max_tokens=2048,
                messages=[{'role': 'user', 'content': prompt}]
            )

            response_text = response.content[0].text
            parsed = LLMService._extract_json_from_text(response_text)
            overall_confidence = parsed.get('overall_confidence', Decimal('0.7'))

            return parsed, Decimal(str(overall_confidence)), ""

        except Exception as e:
            return {}, Decimal('0'), f"Anthropic call failed: {str(e)}"

    @staticmethod
    def _extract_json_from_text(text: str) -> Dict:
        """Extract JSON from LLM response text"""
        try:
            # Try to find JSON block
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                json_text = json_match.group(0)
                return json.loads(json_text)
            return {}
        except json.JSONDecodeError:
            logger.warning("Could not parse JSON from LLM response")
            return {}


class ParserService:
    """Document parsing orchestration"""

    @staticmethod
    def parse_customer_po(file_path: str, config) -> Tuple[Dict, Decimal, bool, str]:
        """
        Parse customer PO: OCR → LLM → extract structured data.

        Returns:
            Tuple of (parsed_data, overall_confidence, success, error_message)
        """
        start_time = time.time()

        # Step 1: OCR
        ocr_text, ocr_success, ocr_error = OCRService.run_ocr(file_path)
        if not ocr_success:
            processing_time = int((time.time() - start_time) * 1000)
            return {}, Decimal('0'), False, ocr_error

        # Step 2: LLM Parse
        parsed, confidence, llm_error = LLMService.parse_with_llm(
            ocr_text,
            config.llm_provider,
            config.llm_model,
            config.prompt_template or CUSTOMER_PO_PROMPT
        )

        if llm_error:
            processing_time = int((time.time() - start_time) * 1000)
            return {}, Decimal('0'), False, llm_error

        # Step 3: Map products to SKU
        if 'line_items' in parsed:
            parsed['line_items'] = ParserService._map_products_to_sku(parsed['line_items'])

        processing_time = int((time.time() - start_time) * 1000)
        success = confidence >= config.confidence_threshold

        logger.info(f"PO parsing complete: confidence={confidence}, processing={processing_time}ms")
        return parsed, confidence, success, ""

    @staticmethod
    def parse_bank_statement(file_path: str, config) -> Tuple[Dict, Decimal, bool, str]:
        """Parse bank statement"""
        start_time = time.time()

        ocr_text, ocr_success, ocr_error = OCRService.run_ocr(file_path)
        if not ocr_success:
            processing_time = int((time.time() - start_time) * 1000)
            return {}, Decimal('0'), False, ocr_error

        parsed, confidence, llm_error = LLMService.parse_with_llm(
            ocr_text,
            config.llm_provider,
            config.llm_model,
            config.prompt_template or BANK_STATEMENT_PROMPT
        )

        processing_time = int((time.time() - start_time) * 1000)
        success = confidence >= config.confidence_threshold

        return parsed, confidence, success, llm_error if not success else ""

    @staticmethod
    def parse_invoice(file_path: str, config) -> Tuple[Dict, Decimal, bool, str]:
        """Parse invoice"""
        start_time = time.time()

        ocr_text, ocr_success, ocr_error = OCRService.run_ocr(file_path)
        if not ocr_success:
            processing_time = int((time.time() - start_time) * 1000)
            return {}, Decimal('0'), False, ocr_error

        parsed, confidence, llm_error = LLMService.parse_with_llm(
            ocr_text,
            config.llm_provider,
            config.llm_model,
            config.prompt_template or INVOICE_PROMPT
        )

        processing_time = int((time.time() - start_time) * 1000)
        success = confidence >= config.confidence_threshold

        return parsed, confidence, success, llm_error if not success else ""

    @staticmethod
    def _map_products_to_sku(line_items: List[Dict]) -> List[Dict]:
        """
        Fuzzy match product descriptions to SKU codes.
        Integration point with inventory module.
        """
        from difflib import SequenceMatcher

        for item in line_items:
            if 'product_description' not in item:
                continue

            description = item['product_description'].get('value', '').lower()
            # This is a placeholder - actual implementation would query SKU database
            item['matched_sku'] = None
            item['sku_confidence'] = Decimal('0')

            logger.info(f"Product mapping for: {description}")

        return line_items
