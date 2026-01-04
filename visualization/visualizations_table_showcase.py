#!/usr/bin/env python3
"""
Generate styled table showcase for top players by tournament wins
"""

import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

DB_PATH = 'db/vgc.db'

def create_tournament_wins_table():
    """Create a beautiful table image for top players by tournament wins in 2025"""
    conn = sqlite3.connect(DB_PATH)
    query = """
    SELECT 
        p.name, 
        COUNT(DISTINCT t.id) as tournaments_played,
        SUM(ts.wins) as total_match_wins,
        SUM(ts.losses) as total_match_losses,
        SUM(ts.ties) as total_ties,
        ROUND(100.0 * SUM(ts.wins) / NULLIF(SUM(ts.wins) + SUM(ts.losses), 0), 2) as win_rate,
        SUM(CASE WHEN ts.placing = 1 THEN 1 ELSE 0 END) as tournaments_won
    FROM tournament_standings ts
    JOIN players p ON ts.player_id = p.id
    JOIN tournaments t ON ts.tournament_id = t.id
    WHERE t.date >= '2025-01-01' AND t.date < '2026-01-01'
    GROUP BY p.id
    HAVING tournaments_won >= 1
    ORDER BY tournaments_won DESC, win_rate DESC
    LIMIT 10
    """
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    if len(df) < 2:
        print("Not enough data for visualization")
        return
    
    # Create figure with white background
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_axis_off()
    plt.subplots_adjust(left=0.04, right=0.96, top=0.88, bottom=0.1)
    
    # Title
    title_text = ax.text(0.5, 0.98, 
                         'Top Players by Limitless Tournament Wins - 2025 Season',
                         ha='center', va='top', 
                         fontsize=18, fontweight='bold',
                         color='#1a1a2a',
                         transform=ax.transAxes)
    
    subtitle_text = ax.text(0.5, 0.94, 
                            'All formats included',
                            ha='center', va='top', 
                            fontsize=11,
                            color='#666666',
                            style='italic',
                            transform=ax.transAxes)
    
    # Column headers
    headers = ['Player', 'Tournaments Won', 'Tournaments Played', 'Match Record', 'Match Win Rate']
    header_y = 0.86
    
    col_width = [0.26, 0.17, 0.18, 0.16, 0.14]
    col_x = [0.06, 0.29, 0.48, 0.67, 0.83]
    col_colors = ['#e74c3c', '#e74c3c', '#e74c3c', '#34495e', '#27ae60', '#3498db']
    
    for i, (header, color, width, x) in enumerate(zip(headers, col_colors, col_width, col_x)):
        # Shift player heading slightly to the right
        if i == 0:
            header_x = x + 0.01
        else:
            header_x = x
        
        ax.text(header_x, header_y, header, 
                ha='center', va='center',
                fontsize=11, fontweight='bold',
                color='white',
                bbox=dict(boxstyle='round,pad=0.3', 
                         facecolor=color, 
                         edgecolor='none',
                         alpha=1.0),
                transform=ax.transAxes)
    
    # Data rows
    row_y = header_y - 0.065
    row_count = 0
    
    for idx, row in df.iterrows():
        tourn_wins = int(row.tournaments_won)
        match_rate = float(row.win_rate)
        
        # Color gradient for tournament wins
        if tourn_wins >= 8:
            win_color = '#27ae60'
        elif tourn_wins >= 6:
            win_color = '#2ecc71'
        elif tourn_wins >= 4:
            win_color = '#3498db'
        elif tourn_wins >= 2:
            win_color = '#f39c12'
        else:
            win_color = '#f1c40f'
        
        # Data values
        player_display = str(row['name'])
        
        data_values = [
            player_display,
            f"{tourn_wins}",
            f"{int(row.tournaments_played)}",
            f"{int(row.total_match_wins)}W - {int(row.total_match_losses)}L",
            f"{match_rate:.1f}%"
        ]
        
        # Calculate text vertical position (centered between header and separator)
        text_y = row_y - 0.035
        
        # Make first place winner's row bold
        weight = 'bold' if idx == 0 else 'normal'
        
        for i, (val, width, x) in enumerate(zip(data_values, col_width, col_x)):
            if i == 0:  # Player name
                ax.text(x - 0.015, text_y, val,
                        ha='left', va='center',
                        fontsize=10.5,
                        color='#1a1a2a',
                        fontweight=weight,
                        transform=ax.transAxes)
            elif (i == 1) or (i == 4):  # Tournaments won or win rate
                ax.text(x, text_y, val,
                        ha='center', va='center',
                        fontsize=10.5, fontweight=weight,
                        color=win_color,
                        transform=ax.transAxes)
            else:  # Other columns
                ax.text(x, text_y, val,
                        ha='center', va='center',
                        fontsize=10,
                        color='#333333',
                        fontweight=weight,
                        transform=ax.transAxes)
        
        # Row separator line
        if row_count < (len(df) - 1):
            ax.plot([0.03, 0.97], [row_y - 0.052, row_y - 0.052],
                   color='#e0e0e0', linewidth=0.5, linestyle='-',
                   transform=ax.transAxes)
        
        row_y -= 0.053
        row_count += 1
    
    # Footer
    footer = ax.text(0.5, 0.08,
                     f'Based on 2025 tournament data from {len(df)} top players',
                     ha='center', va='bottom',
                     fontsize=9,
                     color='#888888',
                     style='italic',
                     transform=ax.transAxes)
    
    # Decorative border
    rect = mpatches.Rectangle((0, 0), 1, 1, 
                           linewidth=3, edgecolor='#3498db',
                           facecolor='none',
                           transform=ax.transAxes)
    ax.add_patch(rect)
    
    plt.tight_layout()
    plt.savefig('../visualizations/top_players_tournament_wins_all_formats.png', 
                dpi=300, bbox_inches='tight', 
                facecolor='white',
                edgecolor='none')
    print("✅ Saved: visualizations/top_players_tournament_wins_all_formats.png")
    plt.close()

def main():
    print("Generating Tournament Wins Table...\n")
    
    try:
        create_tournament_wins_table()
        print("\n✨ Table image complete!")
        print("Check 'visualizations/top_players_tournament_wins_all_formats.png' for result.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
