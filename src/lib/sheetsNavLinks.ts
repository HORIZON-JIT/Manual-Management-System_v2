import { WorkInstruction } from '@/types/instruction';

interface SheetProperties {
  sheetId: number;
  title: string;
  index: number;
}

interface SheetsGetResponse {
  sheets: { properties: SheetProperties }[];
}

/** Build the tab name for a step (must match exportSpreadsheet.ts logic) */
function stepTabName(index: number, title: string): string {
  const stepNum = String(index + 1).padStart(2, '0');
  return `${stepNum} ${title}`.replace(/[\\/*?[\]:]/g, '').substring(0, 31);
}

const BLUE_BG = { red: 0.145, green: 0.388, blue: 0.922 };
const BTN_BG = { red: 0.231, green: 0.510, blue: 0.965 };  // primaryLight
const WHITE = { red: 1.0, green: 1.0, blue: 1.0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function linkCellRequest(
  sheetId: number,
  rowIndex: number,
  colIndex: number,
  label: string,
  targetUri: string,
  bg: { red: number; green: number; blue: number },
  fg: { red: number; green: number; blue: number },
  fontSize: number,
) {
  return {
    updateCells: {
      range: {
        sheetId,
        startRowIndex: rowIndex,
        endRowIndex: rowIndex + 1,
        startColumnIndex: colIndex,
        endColumnIndex: colIndex + 1,
      },
      rows: [{
        values: [{
          userEnteredValue: { stringValue: label },
          userEnteredFormat: {
            backgroundColor: bg,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: {
              foregroundColor: fg,
              bold: true,
              fontSize,
            },
          },
          textFormatRuns: [{
            startIndex: 0,
            format: {
              foregroundColor: fg,
              link: { uri: targetUri },
            },
          }],
        }],
      }],
      fields: 'userEnteredValue,userEnteredFormat,textFormatRuns',
    },
  };
}

/**
 * After uploading an XLSX (converted to Google Sheets format), add proper
 * internal navigation links:
 * 1. Nav footer at the bottom of each step sheet ("次へ →" / "↑ 概要へ戻る")
 * 2. Index "→ 開く" buttons on the main sheet's table of contents
 */
export async function addStepNavLinks(
  spreadsheetId: string,
  instruction: WorkInstruction,
  stepNavRows: number[],
  indexNavRows: number[],
): Promise<void> {
  const token = gapi.client.getToken()?.access_token;
  if (!token) throw new Error('Google認証が必要です');

  // 1. Get all sheets with their gids
  const getRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!getRes.ok) {
    const err = await getRes.text();
    throw new Error(`Sheets API ${getRes.status}: ${err}`);
  }
  const sheetsData = await getRes.json() as SheetsGetResponse;
  const sheetList = sheetsData.sheets.map((s) => s.properties);

  // Build expected tab names for each step
  const sortedSteps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const stepNames = sortedSteps.map((s, i) => stepTabName(i, s.title));

  // Match step names to gids
  const stepGids: number[] = [];
  for (const name of stepNames) {
    const found = sheetList.find((s) => s.title === name);
    if (found) stepGids.push(found.sheetId);
  }

  // Find main sheet gid (first sheet = "作業手順書")
  const mainSheet = sheetList.find((s) => s.index === 0);
  const mainGid = mainSheet ? mainSheet.sheetId : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = [];

  // 2a. Step sheet footer nav links ("次へ →" / "↑ 概要へ戻る")
  // Nav footer cell is in column B (index 1) — the first cell of the B-N merge
  stepGids.forEach((gid, i) => {
    const isLast = i === stepGids.length - 1;
    const label = isLast ? '↑ 概要へ戻る' : '次へ →';
    const targetGid = isLast ? mainGid : stepGids[i + 1];
    const navRowIndex = stepNavRows[i] ?? 0;
    requests.push(linkCellRequest(
      gid, navRowIndex, 1, label, `#gid=${targetGid}&range=A1`,
      BLUE_BG, WHITE, 13,
    ));
  });

  // 2b. Main sheet index "→ 開く" buttons
  // Index button cell is in column M (index 12) — the first cell of the M-N merge
  const INDEX_BTN_COL = 12;  // column M (0-based)
  indexNavRows.forEach((rowIdx, i) => {
    if (i < stepGids.length) {
      requests.push(linkCellRequest(
        mainGid, rowIdx, INDEX_BTN_COL, '→ 開く', `#gid=${stepGids[i]}&range=A1`,
        BTN_BG, WHITE, 11,
      ));
    }
  });

  if (requests.length === 0) return;

  // 3. Apply batchUpdate
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    throw new Error(`Sheets API batchUpdate ${updateRes.status}: ${err}`);
  }
}
