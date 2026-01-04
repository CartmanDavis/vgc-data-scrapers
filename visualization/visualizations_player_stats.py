#!/usr/bin/env python3
"""
Generate player performance visualization
"""

import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

DB_PATH = 'db/vgc.db'

def plot_top_players_2025():
    """Plot top players by win percentage in 2025"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        p.name, 
        COUNT(ts.id) as tournaments_played,
        SUM(ts.wins) as total_wins,
        SUM(ts.losses) as total_losses,
        SUM(ts.ties) as total_ties,
        ROUND(100.0 * SUM(ts.wins) / NULLIF(SUM(ts.wins) + SUM(ts.losses), 0), 2) as win_percentage
    FROM tournament_standings ts 
    JOIN players p ON ts.player_id = p.id 
    JOIN tournaments t ON ts.tournament_id = t.id
    WHERE t.date LIKE '2025-%'
    GROUP BY p.id 
    HAVING COUNT(ts.id) >= 5
    ORDER BY win_percentage DESC
    LIMIT 10
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    if len(df) < 2:
        print("Not enough data for visualization")
        return
    
    df = df.sort_values('win_percentage', ascending=True)
    
    fig, ax = plt.subplots(figsize=(14, 8))
    
    colors = plt.cm.RdYlGn_r(df['win_percentage'] / 100)
    
    bars = ax.barh(df['name'], df['win_percentage'], color=colors, edgecolor='black', linewidth=0.8)
    
    ax.set_xlabel('Win Percentage (%)', fontsize=13, fontweight='bold')
    ax.set_title('Top 10 Players by Win Percentage in 2025\n(Minimum 5 Tournaments Played)', 
                fontsize=16, fontweight='bold', pad=15)
    ax.set_xlim(70, 85)
    
    for i, row in df.iterrows():
        width = bars[i].get_width()
        ax.text(width + 0.3, i, 
                f'{row["win_percentage"]:.1f}%',
                ha='left', va='center', fontsize=11, fontweight='bold')
        ax.text(width + 0.3, i, 
                f'{row["total_wins"]}W-{row["total_losses"]}L',
                ha='left', va='center', fontsize=9.5, color='#555555')
    
    ax.grid(axis='x', alpha=0.3, linestyle='--', linewidth=0.5)
    ax.invert_yaxis()
    
    plt.tight_layout()
    plt.savefig('../visualizations/top_players_2025.png', dpi=300, bbox_inches='tight', facecolor='white')
    print("✅ Saved: visualizations/top_players_2025.png")
    plt.close()

def main():
    print("Generating Player Performance Visualization...\n")
    
    try:
        plot_top_players_2025()
        print("\n✨ Visualization complete!")
        print("Check 'visualizations/top_players_2025.png' for the result.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
