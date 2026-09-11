/**
 * UserSessions.io — MBR Generator
 * Generates Monthly Business Review PDFs using @react-pdf/renderer.
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer'
import { MBRMetrics } from './types'

// We try to register fonts if they exist in public/, else it falls back nicely
try {
  Font.register({
    family: 'Instrument Serif',
    src: 'http://localhost:3000/fonts/InstrumentSerif-Italic.ttf', // In a real env, use absolute URLs
  })
  Font.register({
    family: 'DM Mono',
    src: 'http://localhost:3000/fonts/DMMono-Regular.ttf',
  })
} catch (e) {
  // Ignore font registration errors
}

const styles = StyleSheet.create({
  pageCover: {
    backgroundColor: '#09090F',
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
  },
  pageBody: {
    backgroundColor: '#F4F2ED',
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
  },
  titleCover: {
    fontSize: 48,
    color: '#FFFFFF',
    fontFamily: 'Helvetica', // Fallback until fonts are perfectly wired
    marginBottom: 20,
  },
  subtitleCover: {
    fontSize: 18,
    color: '#B0A898',
    fontFamily: 'Helvetica',
    marginBottom: 60,
  },
  accentLine: {
    width: 60,
    height: 4,
    backgroundColor: '#fca311',
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    color: '#1A150F',
    marginBottom: 24,
    marginTop: 40,
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2D9C8',
    paddingVertical: 12,
  },
  colLeft: {
    fontSize: 12,
    color: '#7A6E63',
  },
  colRight: {
    fontSize: 12,
    color: '#1A150F',
    fontWeight: 'bold',
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2D9C8',
    width: '48%',
    marginBottom: 20,
  },
  metricLabel: {
    fontSize: 10,
    color: '#7A6E63',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    color: '#1A150F',
  },
  metricRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
})

interface MBRProps {
  clientName: string
  metrics: MBRMetrics
}

const MBRDocument = ({ clientName, metrics }: MBRProps) => (
  <Document>
    {/* Cover Page */}
    <Page size="A4" style={styles.pageCover}>
      <View style={styles.accentLine} />
      <Text style={styles.titleCover}>Monthly Business Review</Text>
      <Text style={styles.subtitleCover}>{clientName} — {metrics.period_label}</Text>
      <View style={{ flexGrow: 1 }} />
      <Text style={{ fontSize: 10, color: '#7A6E63' }}>Prepared by UserSessions.io</Text>
    </Page>

    {/* Executive Summary */}
    <Page size="A4" style={styles.pageBody}>
      <Text style={styles.sectionTitle}>Executive Summary</Text>
      
      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Findings</Text>
          <Text style={styles.metricValue}>{metrics.findings_total.toLocaleString()}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Actions Executed</Text>
          <Text style={styles.metricValue}>{metrics.actions_executed.toLocaleString()}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>ARR Flagged at Risk</Text>
          <Text style={styles.metricValue}>${metrics.arr_at_risk_usd.toLocaleString()}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Automation Rate</Text>
          <Text style={styles.metricValue}>
            {metrics.actions_executed > 0 
              ? Math.round((metrics.actions_auto_executed / metrics.actions_executed) * 100) 
              : 0}%
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Findings Breakdown</Text>
      <View>
        <View style={styles.row}>
          <Text style={styles.colLeft}>P0 (Critical)</Text>
          <Text style={styles.colRight}>{metrics.findings_by_severity.P0.toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.colLeft}>P1 (High)</Text>
          <Text style={styles.colRight}>{metrics.findings_by_severity.P1.toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.colLeft}>P2 (Medium)</Text>
          <Text style={styles.colRight}>{metrics.findings_by_severity.P2.toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.colLeft}>P3 (Low)</Text>
          <Text style={styles.colRight}>{metrics.findings_by_severity.P3.toLocaleString()}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Actions by Toolkit</Text>
      <View>
        {Object.entries(metrics.actions_by_toolkit).map(([toolkit, count]) => (
          <View style={styles.row} key={toolkit}>
            <Text style={styles.colLeft}>{toolkit}</Text>
            <Text style={styles.colRight}>{count.toLocaleString()}</Text>
          </View>
        ))}
        {Object.keys(metrics.actions_by_toolkit).length === 0 && (
          <Text style={{ fontSize: 12, color: '#7A6E63', fontStyle: 'italic' }}>No actions executed this period.</Text>
        )}
      </View>
    </Page>
  </Document>
)

export async function generateMBRPdf(clientName: string, metrics: MBRMetrics): Promise<Buffer> {
  return await renderToBuffer(<MBRDocument clientName={clientName} metrics={metrics} />)
}
