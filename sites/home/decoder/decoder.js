/**
 * Copyright 2022 Google LLC
 * Modifications Copyright 2024/2025 [Your Name/Org if applicable] - Adapted for multiple contributions, table output, zero-value filtering.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function covertToBinary(bytes) {
  if (!bytes || bytes.length === 0) return '0';
  try {
    // Convert bytes to hex string
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    // Convert hex to BigInt, then to binary string
    const bigIntValue = BigInt(`0x${hex || '0'}`);
    return bigIntValue.toString(2) || '0'; // Ensure '0' is returned for zero value
  } catch (error) {
      console.error("Error during binary conversion:", error, "Input bytes:", bytes);
      return "Error"; // Return error string if conversion fails
  }
}

function renderOutput(contributions) {
  const tableBody = document.getElementById('decoder-output-body');
  if (!tableBody) {
    console.error("Output table body 'decoder-output-body' not found.");
    return;
  }

  // Clear previous results
  tableBody.innerHTML = '';

  if (!contributions || contributions.length === 0) {
    // Display a message if no valid, non-zero contributions found
    const row = tableBody.insertRow();
    row.className = 'no-data-row';
    const cell = row.insertCell();
    cell.colSpan = 4; // Span across all columns
    cell.textContent = 'No valid contributions with non-zero value found.';
    return;
  }

  // Populate the table with data rows
  contributions.forEach(contribution => {
    const row = tableBody.insertRow();
    // Create cells for each piece of data
    const cellBucketBin = row.insertCell();
    const cellValueBin = row.insertCell();
    const cellBucketDec = row.insertCell();
    const cellValueDec = row.insertCell();

    // Populate cells using <code> for styling
    cellBucketBin.innerHTML = `<code>${contribution.bucketInBinary}</code>`;
    cellValueBin.innerHTML = `<code>${contribution.valueInBinary}</code>`;
    cellBucketDec.innerHTML = `<code>${contribution.bucketInDecimal}</code>`;
    cellValueDec.innerHTML = `<code>${contribution.valueInDecimal}</code>`;
  });
}


async function decodePayload(payload) {
  // Base64 decode
  const arr = new Uint8Array([...atob(payload)].map((c) => c.charCodeAt(0)));

  // CBOR decode - expecting { data: [ { bucket: ..., value: ... }, ... ] }
  const decoded = await cbor.decodeFirst(arr);

  // Basic validation of the decoded structure
  if (!decoded || !Array.isArray(decoded.data)) {
    console.error("Decoded CBOR structure mismatch. Expected { data: [...] }.", "Got:", decoded);
    return []; // Return empty array on structure error
  }

  // Process each item in the data array
  const allContributions = decoded.data.map((item, index) => {
    // Validate item structure (presence and type of bucket/value)
    const isBucketValid = item && (item.bucket instanceof Uint8Array || (typeof Buffer !== 'undefined' && item.bucket instanceof Buffer));
    const isValueValid = item && (item.value instanceof Uint8Array || (typeof Buffer !== 'undefined' && item.value instanceof Buffer));

    if (!isBucketValid || !isValueValid) {
        console.warn(`Skipping invalid item at index ${index}.`, item);
        return null; // Mark for filtering
    }

    try {
      // Convert value bytes to BigInt *first* to check for zero
      const valueBytes = item.value;
      const valueHex = Array.from(valueBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      const valueBigInt = BigInt(`0x${valueHex || '0'}`);

      // --- Filter out contributions where the value is zero ---
      if (valueBigInt === 0n) { // Use 0n for BigInt zero literal
          console.log(`Filtering out contribution at index ${index} due to zero value.`);
          return null; // Mark for filtering
      }

      // If value is non-zero, process bucket and prepare output object
      const bucketInBinary = covertToBinary(item.bucket);
      const valueInBinary = valueBigInt.toString(2) || '0'; // Convert the non-zero value
      const bucketBigInt = BigInt(`0x${Array.from(item.bucket, byte => byte.toString(16).padStart(2, '0')).join('') || '0'}`);

      return {
        bucketInBinary: bucketInBinary,
        valueInBinary: valueInBinary,
        bucketInDecimal: bucketBigInt.toString(10), // Calculate decimal directly
        valueInDecimal: valueBigInt.toString(10),   // Use pre-calculated decimal
      };

    } catch (error) {
        console.error(`Error processing item at index ${index}:`, error, "Item:", item);
        return null; // Mark for filtering on error
    }
  });

  // Filter out null entries (invalid items or zero-value items)
  const validContributions = allContributions.filter(item => item !== null);

  return validContributions; // Return array of valid, non-zero contributions
}

async function runDecoder() {
  const payloadInput = document.querySelector('.decoder__input'); // Get the input element
  const payload = payloadInput.value;

  // Clear previous results/state
  renderOutput([]); // Clear table display
  // Optionally clear error messages if an error display area exists

  if (!payload) {
    console.log("Input payload is empty.");
    return; // Exit if no payload
  }

  try {
    // Call the updated decodePayload, which returns an array
    const outputArray = await decodePayload(payload);
    // Call the updated renderOutput with the array of contributions
    renderOutput(outputArray);
  } catch (error) {
    // Basic error handling - log to console
    console.error("Error during decoding process:", error);
    // Optionally update UI to show error
    // renderOutput(null); // Render table in 'no data' state on error
     const tableBody = document.getElementById('decoder-output-body');
     if (tableBody) {
        tableBody.innerHTML = `<tr class="no-data-row"><td colspan="4">Error during decoding: ${error.message}. Check console.</td></tr>`;
     }
  }
}