from __future__ import annotations
import networkx as nx
from typing import Dict, List, Optional, Tuple, Any
from .models import Station, Platform, TrackBlock, Signal, BlockDirection, BlockType


class RailwayNetworkGraph:
    """
    Graph-based topological representation of the railway network.
    Nodes = Stations, Junctions, Signals, Block Boundaries
    Edges = Track Blocks / Sections with length, directionality, capacity, and speed limits.
    """

    def __init__(self):
        self.graph = nx.DiGraph()
        self.stations: Dict[str, Station] = {}
        self.blocks: Dict[str, TrackBlock] = {}
        self.signals: Dict[str, Signal] = {}
        self.platforms: Dict[str, Platform] = {}

    def deep_copy(self) -> RailwayNetworkGraph:
        """Create a completely isolated topological clone with copied nodes, edges, blocks, signals, and stations"""
        new_net = RailwayNetworkGraph()
        for stn in self.stations.values():
            new_net.add_station(Station(**stn.model_dump()))
        for sig in self.signals.values():
            new_net.add_signal(Signal(**sig.model_dump()))
        for blk in self.blocks.values():
            new_net.add_block(TrackBlock(**blk.model_dump()))
        return new_net

    def add_station(self, station: Station):
        self.stations[station.id] = station
        self.graph.add_node(station.id, type="STATION", data=station)
        for platform in station.platforms:
            self.platforms[platform.id] = platform
            self.graph.add_node(platform.id, type="PLATFORM", data=platform)

    def add_signal(self, signal: Signal):
        self.signals[signal.id] = signal
        self.graph.add_node(signal.id, type="SIGNAL", data=signal)

    def add_block(self, block: TrackBlock):
        self.blocks[block.id] = block
        
        # Add forward edge
        self.graph.add_edge(
            block.from_node,
            block.to_node,
            key=block.id,
            block_id=block.id,
            length_km=block.length_km,
            max_speed_kmh=block.max_speed_kmh,
            block_type=block.block_type,
            direction=block.direction,
            data=block
        )
        
        # If bidirectional or loop line, add reverse edge for graph traversal
        if block.direction == BlockDirection.BIDIRECTIONAL:
            self.graph.add_edge(
                block.to_node,
                block.from_node,
                key=f"{block.id}_REV",
                block_id=block.id,
                length_km=block.length_km,
                max_speed_kmh=block.max_speed_kmh,
                block_type=block.block_type,
                direction=block.direction,
                data=block
            )

    def get_block(self, block_id: str) -> Optional[TrackBlock]:
        return self.blocks.get(block_id)

    def get_station(self, station_id: str) -> Optional[Station]:
        return self.stations.get(station_id)

    def get_next_blocks(self, current_block_id: str, direction: BlockDirection) -> List[TrackBlock]:
        current_block = self.blocks.get(current_block_id)
        if not current_block:
            return []
        
        target_node = current_block.to_node if direction == BlockDirection.UP else current_block.from_node
        candidate_blocks = []
        for _, neighbor, data in self.graph.out_edges(target_node, data=True):
            b_id = data.get("block_id")
            if b_id and b_id in self.blocks and b_id != current_block_id:
                candidate_blocks.append(self.blocks[b_id])
        return candidate_blocks

    def find_shortest_path_blocks(self, origin_node: str, destination_node: str) -> List[str]:
        try:
            nodes = nx.shortest_path(self.graph, source=origin_node, target=destination_node, weight="length_km")
            route_blocks = []
            for i in range(len(nodes) - 1):
                u, v = nodes[i], nodes[i+1]
                edge_data = self.graph.get_edge_data(u, v)
                if edge_data and "block_id" in edge_data:
                    route_blocks.append(edge_data["block_id"])
            return route_blocks
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def get_conflicting_blocks(self, block_id: str) -> List[str]:
        """
        Returns block IDs that conflict with the given block (e.g. same physical single line, crossover).
        """
        block = self.blocks.get(block_id)
        if not block:
            return []
        
        conflicts = [block_id]
        # If single line or crossover, any opposing movements on the same physical link conflict
        if block.block_type in (BlockType.SINGLE_LINE_SECTION, BlockType.JUNCTION_CROSSOVER):
            for other_id, other_block in self.blocks.items():
                if other_id != block_id:
                    if {block.from_node, block.to_node} == {other_block.from_node, other_block.to_node}:
                        conflicts.append(other_id)
        return list(set(conflicts))

    def serialize_topology(self) -> Dict[str, Any]:
        return {
            "stations": [s.model_dump() for s in self.stations.values()],
            "blocks": [b.model_dump() for b in self.blocks.values()],
            "signals": [sig.model_dump() for sig in self.signals.values()],
            "platforms": [p.model_dump() for p in self.platforms.values()]
        }
