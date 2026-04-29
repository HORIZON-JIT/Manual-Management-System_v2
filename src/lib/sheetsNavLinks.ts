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

const NAV_COL_INDEX = 13; // column N (0-based)
const HEADER_ROW_INDEX = 0; // first row of each step sheet

const BLUE_FG = { red: 0.145, green: 0.388, blue: 0.922 };
const HEADER_BG = { red: 0.937, green: 0.961, blue: 1.0 };
const BORDER_BLUE = { red: 0.388, green: 0.533, blue: 0.933 };

function navRequest(
  sheetId: number,
  label: string,
  targetUri: string,
) {
  return {
    updateCells: {
      range: {
        sheetId,
        startRowIndex: HEADER_ROW_INDEX,
        endRowIndex: HEADER_ROW_INDEX + 1,
        startColumnIndex: NAV_COL_INDEX,
        endColumnIndex: NAV_COL_INDEX + 1,
      },
      rows: [{
        values: [{
          userEnteredValue: { stringValue: label },
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: {
              foregroundColor: BLUE_FG,
              underline: true,
              bold: true,
              fontSize: 9,
            },
            borders: {
              top: { style: 'SOLID', color: BORDER_BLUE },
              bottom: { style: 'SOLID_MEDIUM', color: BORDER_BLUE },
              right: { style: 'SOLID', color: BORDER_BLUE },
            },
          },
          textFormatRuns: [{
            startIndex: 0,
            format: { link: { uri: targetUri } },
          }],
        }],
      }],
      fields: 'userEnteredValue,userEnteredFormat,textFormatRuns',
    },
  };
}

/**
 * After uploading an XLSX (converted to Google Sheets format), add proper
 * internal navigation links to each step sheet's header row (column N).
 */
export async function addStepNavLinks(
  spreadsheetId: string,
  instruction: WorkInstruction,
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

  // 2. Build batchUpdate requests
  const requests = stepGids.map((gid, i) => {
    const isLast = i === stepGids.length - 1;
    const label = isLast ? '↑ 概要' : '次へ →';
    const targetGid = isLast ? mainGid : stepGids[i + 1];
    const targetUri = `#gid=${targetGid}&range=A1`;
    return navRequest(gid, label, targetUri);
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
