
import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const COLORS = [
  "#8b5cf6",
  "#22c55e",
  "#38bdf8",
  "#f59e0b",
  "#f472b6",
  "#14b8a6",
];

function formatLabel(value) {
  return String(value).replaceAll("_", " ");
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/,/g, "");

  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function isDateColumn(name, values) {
  const dateName = /date|month|year|time/i.test(name);

  const dateValues = values.every((value) =>
    /^\d{4}-\d{2}(-\d{2})?$/.test(String(value))
  );

  return dateName && dateValues;
}

function getChartConfig(rows) {
  if (!rows.length) return null;

  const columns = Object.keys(rows[0]);

  // A single numeric result is best shown as a KPI.
  if (rows.length === 1 && columns.length === 1) {
    const value = toNumber(rows[0][columns[0]]);

    if (value !== null) {
      return {
        type: "kpi",
        label: columns[0],
        value,
      };
    }
  }

  if (rows.length < 2) return null;

  const numericColumns = columns.filter((column) =>
    rows.every(
      (row) =>
        row[column] == null ||
        toNumber(row[column]) !== null
    ) &&
    rows.some(
      (row) => toNumber(row[column]) !== null
    )
  );

  const labelColumns = columns.filter(
    (column) => !numericColumns.includes(column)
  );

  if (!numericColumns.length || !labelColumns.length) {
    return null;
  }

  const labelColumn = labelColumns[0];
  const valueColumn = numericColumns[0];

  const chartData = rows
    .filter((row) => row[labelColumn] != null)
    .slice(0, 30)
    .map((row) => ({
      name: String(row[labelColumn]),
      value: toNumber(row[valueColumn]) ?? 0,
    }));

  if (chartData.length < 2) return null;

  const chronological = isDateColumn(
    labelColumn,
    chartData.map((row) => row.name)
  );

  if (chronological) {
    chartData.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  const allNonNegative = chartData.every(
    (row) => row.value >= 0
  );

  const total = chartData.reduce(
    (sum, row) => sum + row.value,
    0
  );

  let type = "bar";

  if (chronological) {
    type = "line";
  } else if (
    chartData.length <= 6 &&
    allNonNegative &&
    total > 0 &&
    /category|segment|share|distribution/i.test(
      labelColumn
    )
  ) {
    type = "pie";
  }

  return {
    type,
    labelColumn,
    valueColumn,
    chartData,
    limited: rows.length > 30,
  };
}

function AutoChart({ rows }) {
  const config = getChartConfig(rows);

  if (!config) return null;

  if (config.type === "kpi") {
    return (
      <section className="panel">
        <h2>Key Insight</h2>

        <div className="qp-kpi">
          <p>{formatLabel(config.label)}</p>
          <strong>
            {config.value.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
      </section>
    );
  }

  const {
    type,
    chartData,
    valueColumn,
    limited,
  } = config;

  const tooltipStyle = {
    backgroundColor: "#111827",
    border: "1px solid #39445f",
    borderRadius: "8px",
    color: "#ffffff",
  };

  return (
    <section className="panel">
      <h2>Data Visualization</h2>

      <p className="muted">
        {type === "bar"
          ? "Bar chart"
          : type === "line"
          ? "Line chart"
          : "Pie chart"}{" "}
        showing {formatLabel(valueColumn)}
      </p>

      <div className="qp-chart">
        <ResponsiveContainer width="100%" height="100%">
          {type === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
              />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                minTickGap={20}
              />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                name={formatLabel(valueColumn)}
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </LineChart>
          ) : type === "pie" ? (
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="75%"
                label
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name + index}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#334155"
              />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                minTickGap={20}
              />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar
                dataKey="value"
                name={formatLabel(valueColumn)}
                fill="#8b5cf6"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {limited && (
        <p className="muted">
          Chart displays the first 30 returned rows.
        </p>
      )}
    </section>
  );
}

function App() {
  const [question, setQuestion] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [selectedTable, setSelectedTable] = useState("");

  async function uploadCSV(e) {
    e.preventDefault();

    if (!csvFile) {
      setUploadError("Please select a CSV file.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const response = await fetch(
        `${API_URL}/upload-csv`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "CSV upload failed"
        );
      }

      setUploadResult(result);
      setSelectedTable(result.table_name);
      setData(null);
      setError("");
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function askQuestion(e) {
    e.preventDefault();

    if (!question.trim()) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch(`${API_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          table_name: selectedTable || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Query failed"
        );
      }

      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const rows = data?.results || [];
  const columns = rows.length
    ? Object.keys(rows[0])
    : [];

  const previewRows = uploadResult?.preview || [];
  const previewColumns = uploadResult?.columns || [];

  return (
    <div className="app">
      <header className="header">
        <div className="logo">◈ QueryPilot</div>
        <span className="tag">
          AI-Powered SQL Analytics
        </span>
      </header>

      <main className="container">
        <section className="hero">
          <span className="eyebrow">
            NATURAL LANGUAGE ANALYTICS
          </span>

          <h1>Ask questions. Get insights.</h1>

          <p>
            Explore your PostgreSQL database using
            everyday English, powered by Gemini AI.
          </p>
        </section>

        {/* CSV UPLOAD SECTION */}
        <section className="panel">
          <h2>Upload Your Dataset</h2>

          <p className="muted">
            Upload a CSV file to preview and analyze
            your dataset.
          </p>

          <form onSubmit={uploadCSV}>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setCsvFile(e.target.files?.[0] || null);
                setUploadResult(null);
                setUploadError("");
              }}
              style={{
                display: "block",
                marginBottom: "16px",
                padding: "12px",
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #39445f",
                borderRadius: "8px",
                color: "#ffffff",
              }}
            />

            <button
              type="submit"
              disabled={uploading || !csvFile}
            >
              {uploading
                ? "Uploading..."
                : "Upload CSV →"}
            </button>
          </form>

          {uploadError && (
            <div className="error">{uploadError}</div>
          )}

          {uploadResult && (
            <div style={{ marginTop: "20px" }}>
              <h3 style={{ color: "#a78bfa" }}>
                {uploadResult.message}
              </h3>

              <p className="muted">
                File: {uploadResult.filename}
              </p>

              <p className="muted">
                Rows: {uploadResult.rows} |
                Columns: {previewColumns.length}
              </p>

              <h3>Dataset Preview</h3>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {previewColumns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={index}>
                        {previewColumns.map((col) => (
                          <td key={col}>
                            {row[col] == null
                              ? "—"
                              : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* AI QUESTION SECTION */}
        <section className="panel">
          <h2>Ask your database</h2>

          {selectedTable && (
            <p className="muted">
              Active dataset: {selectedTable}
            </p>
          )}

          <form onSubmit={askQuestion}>
            <textarea
              value={question}
              onChange={(e) =>
                setQuestion(e.target.value)
              }
              placeholder="What is the total revenue?"
              rows={3}
            />

            <button
              type="submit"
              disabled={loading || !question.trim()}
            >
              {loading
                ? "Analyzing..."
                : "Generate Insights →"}
            </button>
          </form>

          <div className="examples">
            {[
              "What is the total revenue?",
              "Show sales by region",
              "Show monthly revenue",
              "Show revenue by category",
              "How many orders are there?",
            ].map((item) => (
              <button
                type="button"
                className="example"
                key={item}
                onClick={() => setQuestion(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="error">{error}</div>
        )}

        {/* RESULTS */}
        {data && (
          <section className="results">
            {data.message && (
              <div className="panel">
                <p>{data.message}</p>
              </div>
            )}

            {data.generated_sql && (
              <div className="panel">
                <h2>Generated SQL</h2>

                <pre>
                  <code>{data.generated_sql}</code>
                </pre>
              </div>
            )}

            <AutoChart rows={rows} />

            <div className="panel">
              <h2>Query Results</h2>

              <p className="muted">
                {rows.length} row(s) returned
              </p>

              {rows.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th key={col}>
                            {formatLabel(col)}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={index}>
                          {columns.map((col) => (
                            <td key={col}>
                              {row[col] == null
                                ? "—"
                                : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No rows found.</p>
              )}
            </div>
          </section>
        )}

        <footer>
          QueryPilot · React + FastAPI +
          PostgreSQL + Gemini
        </footer>
      </main>
    </div>
  );
}

export default App;
