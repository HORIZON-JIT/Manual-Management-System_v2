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

// Nav footer spans col B (1, 0-based) to N (13, 0-based); value is in col B
const NAV_START_COL = 1;  // column B (0-based)
const NAV_END_COL = 14;   // exclusive

const BLUE_BG = { red: 0.145, green: 0.388, blue: 0.922 };
const WHITE = { red: 1.0, green: 1.0, blue: 1.0 };

function navRequest(
  sheetId: number,
  navRowIndex: number,  // 0-based row index of the nav footer row
  label: string,
  targetUri: string,
) {
  return {
    updateCells: {
      range: {
        sheetId,
        startRowIndex: navRowIndex,
        endRowIndex: navRowIndex + 1,
        startColumnIndex: NAV_START_COL,
        endColumnIndex: NAV_START_COL + 1,  // only update the first cell of the merge
      },
      rows: [{
        values: [{
          userEnteredValue: { stringValue: label },
          userEnteredFormat: {
            backgroundColor: BLUE_BG,
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: {
              foregroundColor: WHITE,
              bold: true,
              fontSize: 13,
            },
          },
          textFormatRuns: [{
            startIndex: 0,
            format: {
              foregroundColor: WHITE,
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
 * internal navigation links to the nav footer row at the bottom of each step sheet.
 * stepNavRows[i] is the 0-based row index of the nav footer in step sheet i.
 */
export async function addStepNavLinks(
  spreadsheetId: string,
  instruction: WorkInstruction,
  stepNavRows: number[],
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

  // 2. Build batchUpdate requests using stepNavRows for exact row positions
  const requests = stepGids.map((gid, i) => {
    const isLast = i === stepGids.length - 1;
    const label = isLast ? '↑ 概要へ戻る' : '次へ →';
    const targetGid = isLast ? mainGid : stepGids[i + 1];
    const targetUri = `#gid=${targetGid}&range=A1`;
    const navRowIndex = stepNavRows[i] ?? 0;
    return navRequest(gid, navRowIndex, label, targetUri);
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

export { NAV_START_COL, NAV_END_COL };
